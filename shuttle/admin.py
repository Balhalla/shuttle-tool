"""Admin configuration for shuttle app."""
from django.contrib import admin
from .models import Car, Location, TravelTime, Ride, RideAssignment, Reservation


@admin.register(Car)
class CarAdmin(admin.ModelAdmin):
    list_display = ['name', 'license_plate', 'capacity', 'created_at']
    search_fields = ['name', 'license_plate']


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name']


@admin.register(TravelTime)
class TravelTimeAdmin(admin.ModelAdmin):
    list_display = ['origin', 'destination', 'minutes', 'updated_at']
    list_filter = ['origin', 'destination']
    search_fields = ['origin__name', 'destination__name']


class RideAssignmentInline(admin.TabularInline):
    model = RideAssignment
    extra = 1
    raw_id_fields = ['driver', 'car']


@admin.register(Ride)
class RideAdmin(admin.ModelAdmin):
    list_display = ['id', 'origin', 'destination', 'departure_time', 'available_seats', 'is_vip']
    list_filter = ['is_vip', 'departure_time', 'origin', 'destination']
    search_fields = ['origin__name', 'destination__name']
    raw_id_fields = ['created_by']
    inlines = [RideAssignmentInline]


@admin.register(RideAssignment)
class RideAssignmentAdmin(admin.ModelAdmin):
    list_display = ['ride', 'driver', 'car', 'created_at']
    raw_id_fields = ['ride', 'driver', 'car']


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ['id', 'ride', 'user', 'guest_email', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['user__email', 'guest_email']
    raw_id_fields = ['ride', 'user']
