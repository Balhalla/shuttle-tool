"""Tests for shuttle app."""
import io
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User
from shuttle.models import Location, Car, Ride, RideAssignment


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
            '2026-07-15 22:00,Festival Grounds,Camping North,alice@example.com,Van 1,false\n'
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
            '2026-07-15 22:00,Festival Grounds,Camping North,alice@example.com,Van 1,false\n'
            '2026-07-15 22:00,Festival Grounds,Camping North,bob@example.com,Van 2,false\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['rides_created'], 1)
        self.assertEqual(resp.data['assignments_created'], 2)

    def test_ride_without_driver(self):
        """Rows without driver/car create rides with no assignments."""
        csv = (
            'departure_time,origin,destination,driver_email,car_name,is_vip\n'
            '2026-07-15 22:30,Festival Grounds,Camping North,,,true\n'
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
            '2026-07-15 22:00,Nowhere,Camping North\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('row_errors', resp.data)
        self.assertIn('Unknown origin', resp.data['row_errors'][0]['errors'][0])

    def test_unknown_driver(self):
        csv = (
            'departure_time,origin,destination,driver_email,car_name\n'
            '2026-07-15 22:00,Festival Grounds,Camping North,nobody@example.com,Van 1\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('row_errors', resp.data)
        self.assertIn('Unknown driver', resp.data['row_errors'][0]['errors'][0])

    def test_driver_without_car(self):
        csv = (
            'departure_time,origin,destination,driver_email,car_name\n'
            '2026-07-15 22:00,Festival Grounds,Camping North,alice@example.com,\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('row_errors', resp.data)
        self.assertIn('both be provided', resp.data['row_errors'][0]['errors'][0])

    def test_missing_columns(self):
        csv = 'departure_time,origin\n2026-07-15 22:00,Festival Grounds\n'
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
            '2026-07-15 22:00,festival grounds,camping north\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['rides_created'], 1)

    def test_duplicate_driver_in_group(self):
        car2 = Car.objects.create(name='Van 2', capacity=4)
        csv = (
            'departure_time,origin,destination,driver_email,car_name\n'
            '2026-07-15 22:00,Festival Grounds,Camping North,alice@example.com,Van 1\n'
            '2026-07-15 22:00,Festival Grounds,Camping North,alice@example.com,Van 2\n'
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
        csv = 'departure_time,origin,destination\n2026-07-15 22:00,Festival Grounds,Camping North\n'
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 403)

    def test_multiple_rides(self):
        """Different departure times create separate rides."""
        csv = (
            'departure_time,origin,destination\n'
            '2026-07-15 22:00,Festival Grounds,Camping North\n'
            '2026-07-15 22:30,Festival Grounds,Camping North\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['rides_created'], 2)

    def test_iso_datetime_format(self):
        csv = (
            'departure_time,origin,destination\n'
            '2026-07-15T22:00:00,Festival Grounds,Camping North\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)

    def test_european_datetime_format(self):
        csv = (
            'departure_time,origin,destination\n'
            '15/07/2026 22:00,Festival Grounds,Camping North\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)

    def test_short_year_datetime_format(self):
        csv = (
            'departure_time,origin,destination\n'
            '12/02/25 12:30,Festival Grounds,Camping North\n'
        )
        resp = self._upload_csv(csv)
        self.assertEqual(resp.status_code, 201)
