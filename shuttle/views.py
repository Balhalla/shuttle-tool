"""Views for shuttle app."""
import csv
import io
import secrets
from collections import defaultdict
from datetime import timedelta
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.db import transaction

from .models import Car, Location, TravelTime, Ride, RideAssignment, Reservation
from .serializers import (
    CarSerializer, LocationSerializer, TravelTimeSerializer, RideSerializer, RideListSerializer,
    RideAssignmentSerializer, ReservationSerializer, ReservationCreateSerializer,
    PassengerSerializer, DriverPassengerSerializer, AdminAddPassengerSerializer,
)
from .permissions import IsAdmin, IsDriver, IsDriverOrAdmin
from accounts.models import User, DriverAvailability, hash_token
from accounts.serializers import DriverAvailabilitySerializer


# =============================================================================
# Config Endpoint
# =============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def app_config(request):
    """Return public app configuration."""
    data = {
        'title': settings.APP_TITLE,
    }
    if settings.FAVICON_URL:
        data['favicon_url'] = settings.FAVICON_URL
    if settings.DEMO_SITE:
        data['demo_site'] = True
    return Response(data)


# =============================================================================
# Public Views
# =============================================================================

@api_view(['GET'])
@permission_classes([AllowAny])
def public_ride_list(request):
    """List all public rides with availability."""
    # Clean up expired pending reservations first
    Reservation.objects.filter(
        status='pending',
        expires_at__lt=timezone.now()
    ).update(status='cancelled')

    now = timezone.now()
    grace_period = now - timedelta(minutes=15)

    # Show rides that haven't departed yet OR departed within last 15 minutes
    rides = Ride.objects.filter(
        is_vip=False,
        departure_time__gt=grace_period
    ).select_related('origin', 'destination').prefetch_related('assignments')

    # Optional filters
    origin_id = request.query_params.get('origin')
    destination_id = request.query_params.get('destination')
    date = request.query_params.get('date')

    if origin_id:
        rides = rides.filter(origin_id=origin_id)
    if destination_id:
        rides = rides.filter(destination_id=destination_id)
    if date:
        rides = rides.filter(departure_time__date=date)

    # Filter out rides where all drivers have left (unless still in future)
    visible_rides = [
        ride for ride in rides
        if ride.departure_time > now or not ride.all_departed
    ]

    serializer = RideListSerializer(visible_rides, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def public_ride_detail(request, ride_id):
    """Get details of a specific public ride."""
    ride = get_object_or_404(Ride, id=ride_id, is_vip=False)
    serializer = RideSerializer(ride)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def reserve_ride(request, ride_id):
    """Create a reservation. Auto-confirms for authenticated users, sends email for guests."""
    ride = get_object_or_404(Ride, id=ride_id, is_vip=False)

    if ride.is_full:
        return Response(
            {'error': 'This ride is fully booked'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not ride.registration_open:
        return Response(
            {'error': 'Registration is closed for this ride'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if ride.departure_time <= timezone.now():
        return Response(
            {'error': 'This ride has already departed'},
            status=status.HTTP_400_BAD_REQUEST
        )

    serializer = ReservationCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data['email']
    name = serializer.validated_data['name']
    phone = serializer.validated_data['phone']

    # Check if user is authenticated
    user = request.user if request.user.is_authenticated else None

    # Check for existing confirmed reservation for this user/email
    existing_confirmed = Reservation.objects.filter(
        ride=ride,
        status='confirmed'
    ).filter(
        Q(guest_email=email) | Q(user__email=email)
    ).first()

    if existing_confirmed:
        return Response(
            {'error': 'You already have a confirmed reservation for this ride'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # For authenticated users: auto-confirm
    if user and user.email == email:
        # Update user's phone and name if provided
        if phone and user.phone != phone:
            user.phone = phone
            user.save(update_fields=['phone'])
        if name and user.name != name:
            user.name = name
            user.save(update_fields=['name'])

        reservation = Reservation.objects.create(
            ride=ride,
            user=user,
            guest_email=email,
            guest_name=name,
            guest_phone=phone,
            status='confirmed'
        )

        return Response({
            'message': 'Reservation confirmed!',
            'reservation': ReservationSerializer(reservation).data,
            'auto_confirmed': True
        }, status=status.HTTP_201_CREATED)

    # For guests: create pending reservation and send email
    # Check for existing pending reservation
    existing_pending = Reservation.objects.filter(
        ride=ride,
        guest_email=email,
        status='pending'
    ).first()

    if existing_pending and not existing_pending.is_expired:
        return Response(
            {'error': 'You already have a pending reservation for this ride'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Create pending reservation
    raw_confirmation_token = secrets.token_urlsafe(48)
    reservation = Reservation.objects.create(
        ride=ride,
        guest_email=email,
        guest_name=name,
        guest_phone=phone,
        status='pending',
        confirmation_token=hash_token(raw_confirmation_token)
    )

    # Send confirmation email (use raw token in URL)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    confirm_link = f"{frontend_url}/confirm/{raw_confirmation_token}"

    send_mail(
        subject='Confirm Your Shuttle Reservation',
        message=f'''Hi {name},

Please confirm your shuttle reservation:

From: {ride.origin.name}
To: {ride.destination.name}
Departure: {timezone.localtime(ride.departure_time).strftime('%Y-%m-%d %H:%M')}

Click here to confirm: {confirm_link}

This link expires in {settings.RESERVATION_EXPIRY_MINUTES} minutes.

If you did not request this reservation, you can ignore this email.
''',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )

    return Response({
        'message': 'Reservation created. Please check your email to confirm.',
        'reservation_id': reservation.id,
        'expires_at': reservation.expires_at,
        'auto_confirmed': False
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def confirm_reservation(request, token):
    """Confirm a pending reservation."""
    try:
        with transaction.atomic():
            # Use select_for_update to prevent race conditions
            reservation = Reservation.objects.select_for_update().get(
                confirmation_token=hash_token(token),
                status='pending'
            )

            if reservation.is_expired:
                reservation.status = 'cancelled'
                reservation.save()
                return Response(
                    {'error': 'This reservation has expired'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # No need to check ride capacity here - the pending reservation
            # already holds a seat within its 15-minute confirmation window.

            # Get or create user
            user, created = User.objects.get_or_create(
                email=reservation.guest_email,
                defaults={
                    'name': reservation.guest_name,
                    'phone': reservation.guest_phone,
                    'role': 'public'
                }
            )

            # Update phone and name if user already existed
            if not created:
                updated_fields = []
                if reservation.guest_phone and user.phone != reservation.guest_phone:
                    user.phone = reservation.guest_phone
                    updated_fields.append('phone')
                if reservation.guest_name and user.name != reservation.guest_name:
                    user.name = reservation.guest_name
                    updated_fields.append('name')
                if updated_fields:
                    user.save(update_fields=updated_fields)

            reservation.user = user
            reservation.confirm()

            # Generate a session token for the user (7-day expiry)
            from accounts.serializers import UserSerializer
            from accounts.models import SessionToken
            session_token = SessionToken.create_for_user(user)

            return Response({
                'message': 'Reservation confirmed!',
                'reservation': ReservationSerializer(reservation).data,
                'user': UserSerializer(user).data,
                'token': session_token
            })
    except Reservation.DoesNotExist:
        return Response(
            {'error': 'Invalid or expired confirmation link'},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def location_list(request):
    """List all locations."""
    locations = Location.objects.all()
    serializer = LocationSerializer(locations, many=True)
    return Response(serializer.data)


# =============================================================================
# User Views (authenticated users)
# =============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_reservations(request):
    """Get reservations for the current authenticated user."""
    reservations = Reservation.objects.filter(
        Q(user=request.user) | Q(guest_email=request.user.email),
        status='confirmed'
    ).select_related('ride__origin', 'ride__destination').order_by('ride__departure_time')

    # Only show upcoming rides
    reservations = reservations.filter(ride__departure_time__gte=timezone.now())

    serializer = ReservationSerializer(reservations, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_my_reservation(request, reservation_id):
    """Cancel a reservation owned by the current user."""
    try:
        reservation = Reservation.objects.get(
            Q(user=request.user) | Q(guest_email=request.user.email),
            id=reservation_id,
        )
    except Reservation.DoesNotExist:
        return Response({'error': 'Reservation not found'}, status=404)

    if reservation.status == 'cancelled':
        return Response({'error': 'Reservation is already cancelled'}, status=400)

    reservation.cancel()
    return Response({'message': 'Reservation cancelled'})


# =============================================================================
# Driver Views
# =============================================================================

@api_view(['GET'])
@permission_classes([IsDriverOrAdmin])
def driver_rides(request):
    """Get rides assigned to the current driver/admin (including past rides)."""
    # Get rides where the driver has an assignment
    ride_ids = RideAssignment.objects.filter(
        driver=request.user
    ).values_list('ride_id', flat=True)

    rides = Ride.objects.filter(
        id__in=ride_ids
    ).select_related('origin', 'destination').prefetch_related('assignments__driver', 'assignments__car').order_by('-departure_time')
    serializer = RideSerializer(rides, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsDriverOrAdmin])
def driver_ride_detail(request, ride_id):
    """Get details of a specific ride assigned to the driver/admin."""
    # Verify driver has an assignment for this ride
    assignment = get_object_or_404(RideAssignment, ride_id=ride_id, driver=request.user)
    ride = assignment.ride
    serializer = RideSerializer(ride)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsDriverOrAdmin])
def driver_ride_passengers(request, ride_id):
    """Get passenger list for a specific ride.

    Only returns name and presence status - no email or phone.
    """
    # Verify driver has an assignment for this ride
    assignment = get_object_or_404(RideAssignment, ride_id=ride_id, driver=request.user)
    ride = assignment.ride
    reservations = ride.reservations.filter(status='confirmed')
    serializer = DriverPassengerSerializer(reservations, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsDriverOrAdmin])
def driver_mark_passenger_present(request, ride_id, reservation_id):
    """Mark a passenger as present or not present."""
    # Verify driver has an assignment for this ride
    assignment = get_object_or_404(RideAssignment, ride_id=ride_id, driver=request.user)
    ride = assignment.ride
    reservation = get_object_or_404(
        Reservation,
        id=reservation_id,
        ride=ride,
        status='confirmed'
    )

    # Check if another driver already marked this passenger
    if reservation.is_present and reservation.marked_present_by and reservation.marked_present_by != request.user:
        return Response(
            {'error': 'This passenger was marked present by another driver'},
            status=status.HTTP_403_FORBIDDEN
        )

    is_present = request.data.get('is_present', True)
    reservation.is_present = is_present
    if is_present:
        reservation.marked_present_by = request.user
    else:
        reservation.marked_present_by = None
    reservation.save(update_fields=['is_present', 'marked_present_by'])

    return Response(DriverPassengerSerializer(reservation).data)


def send_discord_notification(ride, driver, car, passenger_count):
    """Send a Discord webhook notification about a driver departure."""
    webhook_url = getattr(settings, 'DISCORD_WEBHOOK_URL', '')
    if not webhook_url:
        return

    import requests
    try:
        # Format departure time
        departure_str = timezone.localtime(ride.departure_time).strftime('%H:%M')

        message = {
            'embeds': [{
                'title': 'Driver Departed',
                'color': 0x00ff00,
                'fields': [
                    {'name': 'Driver', 'value': driver.name, 'inline': True},
                    {'name': 'Car', 'value': f"{car.name} ({car.capacity} seats)", 'inline': True},
                    {'name': 'Passengers', 'value': str(passenger_count), 'inline': True},
                    {'name': 'Route', 'value': f"{ride.origin.name} → {ride.destination.name}", 'inline': False},
                    {'name': 'Scheduled Time', 'value': departure_str, 'inline': True},
                ],
            }]
        }

        requests.post(webhook_url, json=message, timeout=5)
    except Exception:
        # Silently fail - don't break the departure flow
        pass


@api_view(['POST'])
@permission_classes([IsDriverOrAdmin])
def driver_depart(request, ride_id):
    """Mark the driver/admin as departed for a ride."""
    assignment = get_object_or_404(RideAssignment, ride_id=ride_id, driver=request.user)

    if assignment.has_departed:
        return Response(
            {'error': 'You have already departed'},
            status=status.HTTP_400_BAD_REQUEST
        )

    assignment.has_departed = True
    assignment.departed_at = timezone.now()
    assignment.save(update_fields=['has_departed', 'departed_at'])

    # Send Discord notification
    ride = assignment.ride
    passenger_count = ride.reservations.filter(status='confirmed').count()
    send_discord_notification(ride, request.user, assignment.car, passenger_count)

    return Response({
        'message': 'Departure recorded',
        'assignment': RideAssignmentSerializer(assignment).data
    })


# =============================================================================
# Admin Views
# =============================================================================

class AdminCarViewSet(viewsets.ModelViewSet):
    """Admin CRUD for cars."""
    queryset = Car.objects.all()
    serializer_class = CarSerializer
    permission_classes = [IsAdmin]


class AdminLocationViewSet(viewsets.ModelViewSet):
    """Admin CRUD for locations."""
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    permission_classes = [IsAdmin]


def _parse_datetime_flexible(value):
    """Parse a datetime string in various formats, returns timezone-aware datetime or None."""
    from django.utils.dateparse import parse_datetime as django_parse_datetime
    from datetime import datetime

    if not value:
        return None

    # Try ISO format first (e.g., 2026-07-15T22:00:00, 2026-07-15T22:00)
    dt = django_parse_datetime(value)
    if dt:
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        return dt

    # Try common formats
    formats = [
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%d/%m/%Y %H:%M:%S',
        '%d/%m/%Y %H:%M',
        '%d/%m/%y %H:%M:%S',
        '%d/%m/%y %H:%M',
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(value, fmt)
            return timezone.make_aware(dt)
        except ValueError:
            continue

    return None


class AdminRideViewSet(viewsets.ModelViewSet):
    """Admin CRUD for rides."""
    queryset = Ride.objects.all().select_related('origin', 'destination').prefetch_related('assignments__driver', 'assignments__car')
    serializer_class = RideSerializer
    permission_classes = [IsAdmin]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['get'])
    def passengers(self, request, pk=None):
        """Get all passengers for a ride."""
        ride = self.get_object()
        reservations = ride.reservations.exclude(status='cancelled')
        serializer = PassengerSerializer(reservations, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_passenger(self, request, pk=None):
        """Add a passenger to a ride (admin only, auto-confirmed, allows overbooking)."""
        ride = self.get_object()

        serializer = AdminAddPassengerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        name = serializer.validated_data['name']
        email = serializer.validated_data.get('email', '')
        phone = serializer.validated_data.get('phone', '')

        # If email provided, get or create a user account so they can log in
        user = None
        if email:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={'name': name, 'phone': phone, 'role': 'public'}
            )
            if not created:
                updated_fields = []
                if phone and user.phone != phone:
                    user.phone = phone
                    updated_fields.append('phone')
                if name and user.name != name:
                    user.name = name
                    updated_fields.append('name')
                if updated_fields:
                    user.save(update_fields=updated_fields)

        reservation = Reservation.objects.create(
            ride=ride,
            user=user,
            guest_name=name,
            guest_email=email,
            guest_phone=phone,
            status='confirmed',
            added_by_admin=True
        )

        return Response(
            PassengerSerializer(reservation).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['delete'], url_path='passengers/(?P<reservation_id>[^/.]+)')
    def remove_passenger(self, request, pk=None, reservation_id=None):
        """Remove a passenger from a ride."""
        ride = self.get_object()
        try:
            reservation = ride.reservations.get(id=reservation_id)
            reservation.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Reservation.DoesNotExist:
            return Response(
                {'error': 'Passenger not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['get', 'post'])
    def assignments(self, request, pk=None):
        """Get or add driver+car assignments for a ride."""
        ride = self.get_object()

        if request.method == 'GET':
            serializer = RideAssignmentSerializer(ride.assignments.all(), many=True)
            return Response(serializer.data)

        # POST - add new assignment
        serializer = RideAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assignment = RideAssignment.objects.create(
            ride=ride,
            driver_id=serializer.validated_data['driver_id'],
            car_id=serializer.validated_data['car_id']
        )

        return Response(
            RideAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['delete'], url_path='assignments/(?P<assignment_id>[^/.]+)')
    def remove_assignment(self, request, pk=None, assignment_id=None):
        """Remove a driver+car assignment from a ride."""
        ride = self.get_object()
        try:
            assignment = ride.assignments.get(id=assignment_id)
            assignment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except RideAssignment.DoesNotExist:
            return Response(
                {'error': 'Assignment not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'], url_path='import-csv', parser_classes=[MultiPartParser])
    def import_csv(self, request):
        """Import rides from a CSV file.

        CSV format: departure_time,origin,destination,driver_email,car_name,is_vip
        Rows with identical (departure_time, origin, destination, is_vip) are merged
        into one ride with multiple driver/car assignments.
        """
        # --- File validation ---
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        if not csv_file.name.endswith('.csv'):
            return Response({'error': 'File must be a .csv file'}, status=status.HTTP_400_BAD_REQUEST)

        if csv_file.size > 1_048_576:  # 1MB
            return Response({'error': 'File too large (max 1MB)'}, status=status.HTTP_400_BAD_REQUEST)

        # --- Parse CSV ---
        try:
            content = csv_file.read().decode('utf-8-sig')  # utf-8-sig handles Excel BOM
        except UnicodeDecodeError:
            return Response({'error': 'File must be UTF-8 encoded'}, status=status.HTTP_400_BAD_REQUEST)

        reader = csv.DictReader(io.StringIO(content))
        if not reader.fieldnames:
            return Response({'error': 'CSV file is empty'}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize headers (strip whitespace, lowercase)
        reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]

        required_headers = {'departure_time', 'origin', 'destination'}
        missing = required_headers - set(reader.fieldnames)
        if missing:
            return Response(
                {'error': f'Missing required columns: {", ".join(sorted(missing))}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Build lookup caches ---
        location_map = {loc.name.lower(): loc for loc in Location.objects.all()}
        driver_map = {u.email.lower(): u for u in User.objects.filter(Q(role='driver') | Q(role='admin'))}
        car_map = {c.name.lower(): c for c in Car.objects.all()}

        # --- Phase 1: Per-row validation ---
        row_errors = []
        parsed_rows = []

        for row_num, row in enumerate(reader, start=2):  # row 1 is header
            errors = []

            # Parse departure_time
            raw_dt = (row.get('departure_time') or '').strip()
            parsed_dt = _parse_datetime_flexible(raw_dt)
            if not parsed_dt:
                errors.append(f'Invalid departure_time: "{raw_dt}"')

            # Lookup origin
            raw_origin = (row.get('origin') or '').strip()
            origin = location_map.get(raw_origin.lower()) if raw_origin else None
            if not raw_origin:
                errors.append('Missing origin')
            elif not origin:
                errors.append(f'Unknown origin: "{raw_origin}"')

            # Lookup destination
            raw_dest = (row.get('destination') or '').strip()
            destination = location_map.get(raw_dest.lower()) if raw_dest else None
            if not raw_dest:
                errors.append('Missing destination')
            elif not destination:
                errors.append(f'Unknown destination: "{raw_dest}"')

            # Parse is_vip
            raw_vip = (row.get('is_vip') or '').strip().lower()
            is_vip = raw_vip in ('true', '1', 'yes')

            # Lookup driver (optional)
            raw_driver = (row.get('driver_email') or '').strip()
            driver = None
            if raw_driver:
                driver = driver_map.get(raw_driver.lower())
                if not driver:
                    errors.append(f'Unknown driver: "{raw_driver}"')

            # Lookup car (optional)
            raw_car = (row.get('car_name') or '').strip()
            car = None
            if raw_car:
                car = car_map.get(raw_car.lower())
                if not car:
                    errors.append(f'Unknown car: "{raw_car}"')

            # Driver and car must both be present or both absent
            if bool(raw_driver) != bool(raw_car):
                errors.append('driver_email and car_name must both be provided or both empty')

            if errors:
                row_errors.append({'row': row_num, 'errors': errors})
            else:
                parsed_rows.append({
                    'departure_time': parsed_dt,
                    'origin': origin,
                    'destination': destination,
                    'is_vip': is_vip,
                    'driver': driver,
                    'car': car,
                })

        if row_errors:
            return Response(
                {'row_errors': row_errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not parsed_rows:
            return Response({'error': 'CSV file contains no data rows'}, status=status.HTTP_400_BAD_REQUEST)

        # --- Phase 2: Group rows and check for duplicates within groups ---
        groups = defaultdict(list)
        for row_data in parsed_rows:
            key = (
                row_data['departure_time'].isoformat(),
                row_data['origin'].id,
                row_data['destination'].id,
                row_data['is_vip'],
            )
            groups[key].append(row_data)

        group_errors = []
        for key, group_rows in groups.items():
            assignments = [(r['driver'], r['car']) for r in group_rows if r['driver'] and r['car']]
            # Check duplicate drivers within same ride
            seen_drivers = set()
            dup_driver_names = []
            for d, _ in assignments:
                if d.id in seen_drivers:
                    dup_driver_names.append(d.name)
                seen_drivers.add(d.id)
            if dup_driver_names:
                dt_str = group_rows[0]['departure_time'].strftime('%Y-%m-%d %H:%M')
                route = f"{group_rows[0]['origin'].name} \u2192 {group_rows[0]['destination'].name}"
                group_errors.append(f'Duplicate driver(s) {", ".join(dup_driver_names)} in ride {route} at {dt_str}')

            # Check duplicate cars within same ride
            seen_cars = set()
            dup_car_names = []
            for _, c in assignments:
                if c.id in seen_cars:
                    dup_car_names.append(c.name)
                seen_cars.add(c.id)
            if dup_car_names:
                dt_str = group_rows[0]['departure_time'].strftime('%Y-%m-%d %H:%M')
                route = f"{group_rows[0]['origin'].name} \u2192 {group_rows[0]['destination'].name}"
                group_errors.append(f'Duplicate car(s) {", ".join(dup_car_names)} in ride {route} at {dt_str}')

        if group_errors:
            return Response(
                {'group_errors': group_errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # --- Phase 3: Atomic creation ---
        rides_created = 0
        assignments_created = 0

        with transaction.atomic():
            for key, group_rows in groups.items():
                sample = group_rows[0]
                ride = Ride.objects.create(
                    origin=sample['origin'],
                    destination=sample['destination'],
                    departure_time=sample['departure_time'],
                    is_vip=sample['is_vip'],
                    created_by=request.user,
                )
                rides_created += 1

                for row_data in group_rows:
                    if row_data['driver'] and row_data['car']:
                        RideAssignment.objects.create(
                            ride=ride,
                            driver=row_data['driver'],
                            car=row_data['car'],
                        )
                        assignments_created += 1

        return Response({
            'rides_created': rides_created,
            'assignments_created': assignments_created,
        }, status=status.HTTP_201_CREATED)


class AdminDriverViewSet(viewsets.ModelViewSet):
    """Admin CRUD for drivers (includes admins who can also drive)."""
    queryset = User.objects.filter(Q(role='driver') | Q(role='admin'))
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        from accounts.serializers import DriverSerializer, UserCreateSerializer
        if self.action == 'create':
            return UserCreateSerializer
        return DriverSerializer

    def perform_create(self, serializer):
        serializer.save(role='driver')


class AdminUserViewSet(viewsets.ModelViewSet):
    """Admin CRUD for all users (including role management)."""
    queryset = User.objects.all().order_by('-created_at')
    permission_classes = [IsAdmin]

    def get_serializer_class(self):
        from accounts.serializers import AdminUserSerializer
        return AdminUserSerializer


class AdminTravelTimeViewSet(viewsets.ModelViewSet):
    """Admin CRUD for travel times between locations."""
    queryset = TravelTime.objects.all().select_related('origin', 'destination')
    serializer_class = TravelTimeSerializer
    permission_classes = [IsAdmin]


class AdminDriverAvailabilityViewSet(viewsets.ModelViewSet):
    """Admin CRUD for driver availability schedules."""
    queryset = DriverAvailability.objects.all().select_related('driver')
    serializer_class = DriverAvailabilitySerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        queryset = super().get_queryset()
        driver_id = self.request.query_params.get('driver_id')
        if driver_id:
            queryset = queryset.filter(driver_id=driver_id)
        return queryset


class AdminReservationViewSet(viewsets.ModelViewSet):
    """Admin view/manage reservations."""
    queryset = Reservation.objects.all().select_related('ride', 'user')
    serializer_class = ReservationSerializer
    permission_classes = [IsAdmin]

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        reservation = self.get_object()
        if reservation.status == 'pending':
            reservation.confirm()
        return Response(ReservationSerializer(reservation).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        reservation.cancel()
        return Response(ReservationSerializer(reservation).data)
