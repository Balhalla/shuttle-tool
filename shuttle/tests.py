"""Tests for shuttle app."""
import io
from datetime import datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User
from shuttle.models import (
    Location,
    Car,
    Ride,
    RideAssignment,
    FestivalProgramItem,
    SiteSettings,
)


class CsvImportTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='admin@example.com', name='Admin', role='admin'
        )
        self.client.force_authenticate(user=self.admin)

        self.loc_festival = Location.objects.create(name='Festival Grounds')
        self.loc_camping = Location.objects.create(name='Camping North')

        self.driver = User.objects.create_user(
            email='alice@example.com', name='Alice', role='driver'
        )
        self.car = Car.objects.create(name='Van 1', capacity=6)

    def _upload_csv(self, content, filename='rides.csv'):
        f = io.BytesIO(content.encode('utf-8'))
        f.name = filename
        return self.client.post(
            '/api/admin/rides/import-csv/',
            {'file': f},
            format='multipart',
        )

    def test_basic_import(self):
        csv = (
            'departure_time,origin,destination,driver_email,car_name,is_vip\n'
            '2027-02-26 22:00,Festival Grounds,Camping North,alice@example.com,Van 1,false\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['rides_created'], 1)
        self.assertEqual(resp.data['assignments_created'], 1)
        self.assertEqual(Ride.objects.count(), 1)
        self.assertEqual(RideAssignment.objects.count(), 1)

    def test_merge_same_ride(self):
        """Rows with same departure/origin/destination/vip merge into one ride."""
        driver2 = User.objects.create_user(
            email='bob@example.com', name='Bob', role='driver'
        )
        car2 = Car.objects.create(name='Van 2', capacity=4)

        csv = (
            'departure_time,origin,destination,driver_email,car_name,is_vip\n'
            '2027-02-26 22:00,Festival Grounds,Camping North,alice@example.com,Van 1,false\n'
            '2027-02-26 22:00,Festival Grounds,Camping North,bob@example.com,Van 2,false\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['rides_created'], 1)
        self.assertEqual(resp.data['assignments_created'], 2)

    def test_ride_without_driver(self):
        """Rows without driver/car create rides with no assignments."""
        csv = (
            'departure_time,origin,destination,driver_email,car_name,is_vip\n'
            '2027-02-26 22:30,Festival Grounds,Camping North,,,true\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['rides_created'], 1)
        self.assertEqual(resp.data['assignments_created'], 0)
        ride = Ride.objects.first()
        self.assertTrue(ride.is_vip)

    def test_unknown_location(self):
        csv = (
            'departure_time,origin,destination\n'
            '2027-02-26 22:00,Nowhere,Camping North\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('row_errors', resp.data)
        self.assertIn('Unknown origin', resp.data['row_errors'][0]['errors'][0])

    def test_unknown_driver(self):
        csv = (
            'departure_time,origin,destination,driver_email,car_name\n'
            '2027-02-26 22:00,Festival Grounds,Camping North,nobody@example.com,Van 1\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('row_errors', resp.data)
        self.assertIn('Unknown driver', resp.data['row_errors'][0]['errors'][0])

    def test_driver_without_car(self):
        csv = (
            'departure_time,origin,destination,driver_email,car_name\n'
            '2027-02-26 22:00,Festival Grounds,Camping North,alice@example.com,\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('row_errors', resp.data)
        self.assertIn('both be provided', resp.data['row_errors'][0]['errors'][0])

    def test_missing_columns(self):
        csv = 'departure_time,origin\n2027-02-26 22:00,Festival Grounds\n'
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Missing required columns', resp.data['error'])

    def test_no_file(self):
        resp = self.client.post('/api/admin/rides/import-csv/', {}, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('No file', resp.data['error'])

    def test_wrong_extension(self):
        f = io.BytesIO(b'hello')
        f.name = 'rides.txt'
        resp = self.client.post(
            '/api/admin/rides/import-csv/',
            {'file': f},
            format='multipart',
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn('.csv', resp.data['error'])

    def test_case_insensitive_location(self):
        csv = (
            'departure_time,origin,destination\n'
            '2027-02-26 22:00,festival grounds,camping north\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['rides_created'], 1)

    def test_duplicate_driver_in_group(self):
        car2 = Car.objects.create(name='Van 2', capacity=4)
        csv = (
            'departure_time,origin,destination,driver_email,car_name\n'
            '2027-02-26 22:00,Festival Grounds,Camping North,alice@example.com,Van 1\n'
            '2027-02-26 22:00,Festival Grounds,Camping North,alice@example.com,Van 2\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('group_errors', resp.data)
        self.assertIn('Duplicate driver', resp.data['group_errors'][0])

    def test_empty_csv(self):
        csv = 'departure_time,origin,destination\n'
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('no data rows', resp.data['error'])

    def test_non_admin_rejected(self):
        public_user = User.objects.create_user(
            email='public@example.com', name='Public', role='public'
        )
        self.client.force_authenticate(user=public_user)
        csv = 'departure_time,origin,destination\n2027-02-26 22:00,Festival Grounds,Camping North\n'
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 403)

    def test_multiple_rides(self):
        """Different departure times create separate rides."""
        csv = (
            'departure_time,origin,destination\n'
            '2027-02-26 22:00,Festival Grounds,Camping North\n'
            '2027-02-26 22:30,Festival Grounds,Camping North\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['rides_created'], 2)

    def test_iso_datetime_format(self):
        csv = (
            'departure_time,origin,destination\n'
            '2027-02-26T22:00:00,Festival Grounds,Camping North\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)

    def test_european_datetime_format(self):
        csv = (
            'departure_time,origin,destination\n'
            '26/02/2027 22:00,Festival Grounds,Camping North\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)

    def test_short_year_datetime_format(self):
        csv = (
            'departure_time,origin,destination\n'
            '26/02/27 12:30,Festival Grounds,Camping North\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)


class FestivalProgramTimelineTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='program-admin@example.com', name='Program Admin', role='admin'
        )
        self.client.force_authenticate(user=self.admin)
        self.site = SiteSettings.get()
        self.site.festival_start_date = '2027-02-26'
        self.site.festival_end_date = '2027-02-28'
        self.site.save()

    def _program_data(self, **overrides):
        data = {
            'title': 'Opening concert',
            'location': 'Main stage',
            'description': 'Festival opening',
            'start_time': '2027-02-26T20:00:00+01:00',
            'end_time': '2027-02-26T21:30:00+01:00',
        }
        data.update(overrides)
        return data

    def test_admin_can_create_update_and_delete_program_item(self):
        response = self.client.post(
            '/api/admin/festival-program/',
            self._program_data(),
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['title'], 'Opening concert')
        self.assertEqual(FestivalProgramItem.objects.count(), 1)

        item_id = response.data['id']
        response = self.client.patch(
            f'/api/admin/festival-program/{item_id}/',
            {'title': 'Opening ceremony'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 'Opening ceremony')

        response = self.client.delete(f'/api/admin/festival-program/{item_id}/')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(FestivalProgramItem.objects.count(), 0)

    def test_program_item_end_must_be_after_start(self):
        response = self.client.post(
            '/api/admin/festival-program/',
            self._program_data(end_time='2027-02-26T19:00:00+01:00'),
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(FestivalProgramItem.objects.count(), 0)

    @patch('shuttle.views.timezone.localtime')
    def test_timeline_returns_only_program_items_in_remaining_festival_dates(
        self,
        mock_localtime,
    ):
        mock_localtime.return_value = datetime(
            2026, 10, 21, 12, 0, tzinfo=ZoneInfo('Europe/Brussels')
        )
        FestivalProgramItem.objects.create(
            title='In range',
            start_time='2027-02-26T20:00:00+01:00',
            end_time='2027-02-26T21:00:00+01:00',
        )
        FestivalProgramItem.objects.create(
            title='Outside range',
            start_time='2027-03-01T20:00:00+01:00',
            end_time='2027-03-01T21:00:00+01:00',
        )

        response = self.client.get('/api/admin/driver-timeline/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['range']['start'], '2027-02-26T06:00:00+01:00')
        self.assertEqual(response.data['range']['end'], '2027-03-01T06:00:00+01:00')
        self.assertEqual(
            [item['title'] for item in response.data['program_items']],
            ['In range'],
        )

    @patch('shuttle.views.timezone.localtime')
    def test_timeline_starts_at_current_operational_festival_date(
        self,
        mock_localtime,
    ):
        mock_localtime.return_value = datetime(
            2027, 2, 27, 12, 0, tzinfo=ZoneInfo('Europe/Brussels')
        )

        response = self.client.get('/api/admin/driver-timeline/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['range']['start'], '2027-02-27T06:00:00+01:00')
        self.assertEqual(response.data['range']['end'], '2027-03-01T06:00:00+01:00')

    @patch('shuttle.views.timezone.localtime')
    def test_timeline_returns_no_range_after_festival(self, mock_localtime):
        mock_localtime.return_value = datetime(
            2027, 3, 1, 6, 0, tzinfo=ZoneInfo('Europe/Brussels')
        )

        response = self.client.get('/api/admin/driver-timeline/')

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['range'])
        self.assertEqual(response.data['drivers'], [])
        self.assertEqual(response.data['program_items'], [])

    def test_non_admin_cannot_manage_program_items(self):
        public_user = User.objects.create_user(
            email='program-public@example.com', name='Public', role='public'
        )
        self.client.force_authenticate(user=public_user)

        response = self.client.post(
            '/api/admin/festival-program/',
            self._program_data(),
            format='json',
        )

        self.assertEqual(response.status_code, 403)


class SiteSettingsTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='settings-admin@example.com', name='Settings Admin', role='admin'
        )
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_define_festival_dates(self):
        response = self.client.patch(
            '/api/admin/settings/',
            {
                'festival_start_date': '2027-02-26',
                'festival_end_date': '2027-02-28',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['festival_start_date'], '2027-02-26')
        self.assertEqual(response.data['festival_end_date'], '2027-02-28')

    def test_festival_end_date_cannot_precede_start_date(self):
        response = self.client.patch(
            '/api/admin/settings/',
            {
                'festival_start_date': '2027-02-28',
                'festival_end_date': '2027-02-26',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('festival_end_date', response.data['error'])


class RideAssignmentTimelineTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='assignment-admin@example.com',
            name='Assignment Admin',
            role='admin',
        )
        self.client.force_authenticate(user=self.admin)

        self.car_one = Car.objects.create(name='Car One', capacity=6)
        self.car_two = Car.objects.create(name='Car Two', capacity=4)
        self.driver_one = User.objects.create_user(
            email='driver-one@example.com',
            name='Driver One',
            role='driver',
            default_car=self.car_one,
        )
        self.driver_two = User.objects.create_user(
            email='driver-two@example.com',
            name='Driver Two',
            role='driver',
            default_car=self.car_two,
        )
        self.origin = Location.objects.create(name='Festival Grounds')
        self.destination = Location.objects.create(name='Camping North')
        self.ride = Ride.objects.create(
            origin=self.origin,
            destination=self.destination,
            departure_time='2027-02-26T22:00:00+01:00',
        )
        self.assignment = RideAssignment.objects.create(
            ride=self.ride,
            driver=self.driver_one,
            car=self.car_one,
        )

    def test_reassigning_assignment_uses_new_driver_default_car(self):
        response = self.client.patch(
            f'/api/admin/rides/{self.ride.id}/assignments/{self.assignment.id}/',
            {'driver_id': self.driver_two.id},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.driver, self.driver_two)
        self.assertEqual(self.assignment.car, self.car_two)

    def test_adding_assignment_without_car_uses_driver_default(self):
        ride = Ride.objects.create(
            origin=self.origin,
            destination=self.destination,
            departure_time='2027-02-27T22:00:00+01:00',
        )

        response = self.client.post(
            f'/api/admin/rides/{ride.id}/assignments/',
            {'driver_id': self.driver_two.id},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        assignment = RideAssignment.objects.get(id=response.data['id'])
        self.assertEqual(assignment.driver, self.driver_two)
        self.assertEqual(assignment.car, self.car_two)

    def test_reassigning_requires_target_driver_default_car(self):
        self.driver_two.default_car = None
        self.driver_two.save(update_fields=['default_car'])

        response = self.client.patch(
            f'/api/admin/rides/{self.ride.id}/assignments/{self.assignment.id}/',
            {'driver_id': self.driver_two.id},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('default car', response.data['error'])
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.driver, self.driver_one)

    def test_departed_assignment_cannot_be_reassigned(self):
        self.assignment.has_departed = True
        self.assignment.save(update_fields=['has_departed'])

        response = self.client.patch(
            f'/api/admin/rides/{self.ride.id}/assignments/{self.assignment.id}/',
            {'driver_id': self.driver_two.id},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('Departed assignments', response.data['error'])
