"""Models for shuttle management."""
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


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
    description = models.TextField(blank=True)
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'travel_times'
        unique_together = ['origin', 'destination']
        ordering = ['origin__name', 'destination__name']

    def __str__(self):
        return f"{self.origin.name} -> {self.destination.name}: {self.minutes} min"


class Ride(models.Model):
    origin = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name='departures'
    )
    destination = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name='arrivals'
    )
    departure_time = models.DateTimeField()
    is_vip = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_rides',
        limit_choices_to={'role': 'admin'}
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rides'
        ordering = ['departure_time']

    def __str__(self):
        return f"{self.origin} → {self.destination} at {self.departure_time}"

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
        """Count of confirmed + active pending reservations.

        Pending reservations hold a seat for the duration of their
        confirmation window so unverified users don't lose their spot.
        """
        from django.db.models import Q
        from django.utils import timezone
        return self.reservations.filter(
            Q(status='confirmed') |
            Q(status='pending', expires_at__gt=timezone.now())
        ).count()

    @property
    def seats_remaining(self):
        """Available seats minus reserved (confirmed + active pending)."""
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
        """Check if new registrations are allowed.

        Registration is closed if:
        - All drivers have departed
        - Remaining capacity (from non-departed drivers) equals or is less than current reservations
        """
        if self.all_departed:
            return False
        # Check if remaining capacity can only accommodate current passengers
        if self.remaining_capacity <= self.reserved_seats:
            return False
        return True


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
