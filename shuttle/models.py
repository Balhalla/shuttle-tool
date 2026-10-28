"""Models for shuttle management."""
from django.core.validators import MinValueValidator
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import date, time, timedelta


class Car(models.Model):
    name = models.CharField(max_length=255)
    license_plate = models.CharField(max_length=20, blank=True)
    capacity = models.PositiveIntegerField(help_text="Maximum number of passengers")
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cars'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.capacity} seats)"


class Location(models.Model):
    name = models.CharField(max_length=255)
    short_name = models.CharField(
        max_length=4,
        help_text='Compact name shown in the timeline',
    )
    description = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'locations'
        ordering = ['name']

    def __str__(self):
        return self.name


class TravelTime(models.Model):
    """Travel time between two locations (in minutes)."""
    origin = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name='travel_times_from'
    )
    destination = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name='travel_times_to'
    )
    minutes = models.PositiveIntegerField(help_text="Travel time in minutes")
    distance_meters = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'travel_times'
        unique_together = ['origin', 'destination']
        ordering = ['origin__name', 'destination__name']

    def __str__(self):
        return f"{self.origin.name} -> {self.destination.name}: {self.minutes} min"


class ActiveRideManager(models.Manager):
    """Default manager that excludes soft-deleted rides."""
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class Ride(models.Model):
    departure_time = models.DateTimeField()
    is_vip = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_rides',
        limit_choices_to={'role': 'admin'}
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveRideManager()
    all_objects = models.Manager()

    def __init__(self, *args, **kwargs):
        # Compatibility for existing internal callers; route stops remain canonical.
        self._initial_origin_id = kwargs.pop('origin_id', None)
        self._initial_destination_id = kwargs.pop('destination_id', None)
        initial_origin = kwargs.pop('origin', None)
        initial_destination = kwargs.pop('destination', None)
        if initial_origin is not None:
            self._initial_origin_id = initial_origin.pk
        if initial_destination is not None:
            self._initial_destination_id = initial_destination.pk
        super().__init__(*args, **kwargs)

    @property
    def origin(self):
        stops = self.ordered_stops
        return stops[0].location if stops else None

    @property
    def origin_id(self):
        stops = self.ordered_stops
        return stops[0].location_id if stops else None

    @property
    def destination(self):
        stops = self.ordered_stops
        return stops[-1].location if stops else None

    @property
    def destination_id(self):
        stops = self.ordered_stops
        return stops[-1].location_id if stops else None

    class Meta:
        db_table = 'rides'
        ordering = ['departure_time']

    def __str__(self):
        return f"{self.origin} → {self.destination} at {self.departure_time}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        # Preserve a valid two-stop route for legacy internal creation paths.
        if is_new and not self.route_stops.exists():
            if self._initial_origin_id is None or self._initial_destination_id is None:
                raise ValueError('A ride must be created with an ordered route.')
            RideStop.objects.bulk_create([
                RideStop(ride=self, location_id=self._initial_origin_id, position=0),
                RideStop(ride=self, location_id=self._initial_destination_id, position=1),
            ])

    @property
    def ordered_stops(self):
        return list(self.route_stops.select_related('location').order_by('position'))

    def stop_times(self):
        stops = self.ordered_stops
        result = []
        current = self.departure_time
        for index, stop in enumerate(stops):
            if index:
                travel = TravelTime.objects.filter(origin_id=stops[index - 1].location_id,
                    destination_id=stop.location_id).first()
                if not travel:
                    return []
                current += timedelta(minutes=travel.minutes)
            result.append({'position': index, 'location': stop.location, 'time': current})
        return result

    @property
    def total_travel_minutes(self):
        times = self.stop_times()
        if len(times) != len(self.ordered_stops) or len(times) < 2:
            stops = self.ordered_stops
            if len(stops) >= 2:
                legacy_time = TravelTime.objects.filter(
                    origin_id=stops[0].location_id,
                    destination_id=stops[-1].location_id,
                ).first()
                return legacy_time.minutes if legacy_time else 0
            return 0
        return int((times[-1]['time'] - times[0]['time']).total_seconds() // 60)

    def seats_remaining_for(self, pickup_position, dropoff_position):
        from django.db.models import Q, Sum
        active = self.reservations.filter(Q(status='confirmed') | Q(status='pending', expires_at__gt=timezone.now()))
        reserved = active.filter(pickup_position__lt=dropoff_position,
            dropoff_position__gt=pickup_position).aggregate(total=Sum('seats'))['total'] or 0
        capacity = sum(a.car.capacity for a in self.assignments.all() if a.car)
        return capacity - reserved

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.save()

    @property
    def available_seats(self):
        """Total capacity from all assigned cars."""
        return sum(
            assignment.car.capacity
            for assignment in self.assignments.all()
            if assignment.car
        )

    @property
    def remaining_capacity(self):
        """Capacity from drivers who have not yet departed."""
        return sum(
            assignment.car.capacity
            for assignment in self.assignments.all()
            if assignment.car and not assignment.has_departed
        )

    @property
    def reserved_seats(self):
        """Peak occupied seats on any route segment."""
        from django.db.models import Q
        from django.utils import timezone
        active = list(self.reservations.filter(
            Q(status='confirmed') |
            Q(status='pending', expires_at__gt=timezone.now())
        ).values_list('pickup_position', 'dropoff_position', 'seats'))
        stops = self.ordered_stops
        if len(stops) < 2:
            return sum(seats for _, _, seats in active)
        return max(
            (sum(seats for pickup, dropoff, seats in active if pickup <= segment < dropoff)
             for segment in range(len(stops) - 1)),
            default=0,
        )

    @property
    def seats_remaining(self):
        """Minimum free seats across route segments."""
        return self.available_seats - self.reserved_seats

    @property
    def is_full(self):
        return self.seats_remaining <= 0

    @property
    def all_departed(self):
        """Check if all drivers have departed."""
        assignments = self.assignments.all()
        if not assignments:
            return False
        return all(a.has_departed for a in assignments)

    @property
    def registration_open(self):
        """Bookings close when the first assigned vehicle departs."""
        return (
            self.departure_time > timezone.now()
            and not self.assignments.filter(has_departed=True).exists()
        )


class RideAssignment(models.Model):
    """Links a driver and their car to a ride."""
    ride = models.ForeignKey(
        Ride,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    driver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ride_assignments',
        limit_choices_to={'role__in': ['driver', 'admin']}
    )
    car = models.ForeignKey(
        Car,
        on_delete=models.CASCADE,
        related_name='ride_assignments'
    )
    has_departed = models.BooleanField(default=False)
    departed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ride_assignments'
        unique_together = [['ride', 'driver'], ['ride', 'car']]
        ordering = ['created_at']

    def __str__(self):
        return f"{self.driver.name} with {self.car.name} on {self.ride}"


class RideStop(models.Model):
    ride = models.ForeignKey(Ride, on_delete=models.CASCADE, related_name='route_stops')
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name='ride_stops')
    position = models.PositiveIntegerField()

    class Meta:
        db_table = 'ride_stops'
        ordering = ['position']
        unique_together = [('ride', 'position')]

    def __str__(self):
        return f"{self.ride_id} stop {self.position}: {self.location}"


class Reservation(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
    ]

    ride = models.ForeignKey(
        Ride,
        on_delete=models.CASCADE,
        related_name='reservations'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='reservations'
    )
    guest_email = models.EmailField(blank=True)
    guest_name = models.CharField(max_length=255)
    guest_phone = models.CharField(max_length=20, blank=True)
    seats = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
    )
    pickup_position = models.PositiveIntegerField(default=0)
    dropoff_position = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    confirmation_token = models.CharField(max_length=64, blank=True, null=True, unique=True)
    added_by_admin = models.BooleanField(default=False)
    is_present = models.BooleanField(default=False)
    marked_present_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='marked_passengers'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'reservations'
        ordering = ['-created_at']

    def __str__(self):
        email = self.user.email if self.user else self.guest_email
        return f"Reservation for {email} on {self.ride}"

    def save(self, *args, **kwargs):
        # Set expiry for pending reservations
        if self.status == 'pending' and not self.expires_at:
            expiry_minutes = getattr(settings, 'RESERVATION_EXPIRY_MINUTES', 15)
            self.expires_at = timezone.now() + timedelta(minutes=expiry_minutes)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        if self.status != 'pending':
            return False
        if not self.expires_at:
            return False
        return timezone.now() > self.expires_at

    def confirm(self):
        """Confirm the reservation."""
        self.status = 'confirmed'
        self.confirmation_token = None
        self.expires_at = None
        self.save()

    def cancel(self):
        """Cancel the reservation."""
        self.status = 'cancelled'
        self.save()


class SiteSettings(models.Model):
    """Singleton model for site-wide settings."""
    banner_enabled = models.BooleanField(default=False)
    banner_text = models.TextField(blank=True, default='')
    festival_start_date = models.DateField(default=date(2027, 2, 26))
    festival_end_date = models.DateField(default=date(2027, 2, 28))
    day_change_time = models.TimeField(
        default=time(6, 0),
        help_text='Time at which the operational day changes',
    )
    google_routes_api_key = models.CharField(max_length=255, blank=True, default='')
    base_location = models.ForeignKey(
        'Location', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='base_for_settings'
    )
    show_driver_phones = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Site Settings'

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Site Settings'


class BlockedPeriod(models.Model):
    """A time period during which a specific driver should not be booked."""
    driver = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='blocked_periods',
        limit_choices_to={'role__in': ['driver', 'admin']}
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    reason = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'blocked_periods'
        ordering = ['start_time']

    def __str__(self):
        return f"Blocked: {self.driver.name} {self.start_time} – {self.end_time} ({self.reason})"


class FestivalProgramItem(models.Model):
    """An act, performance, or other item in the festival program."""
    title = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True, default='')
    description = models.TextField(blank=True, default='')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'festival_program_items'
        ordering = ['start_time', 'title']

    def __str__(self):
        return f"{self.title} at {self.start_time.strftime('%Y-%m-%d %H:%M')}"
