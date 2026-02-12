"""Serializers for shuttle app."""
from rest_framework import serializers
from .models import Car, Location, TravelTime, Ride, RideAssignment, Reservation
from accounts.serializers import UserSerializer, DriverSerializer


class CarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Car
        fields = ['id', 'name', 'license_plate', 'capacity', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = ['id', 'name', 'description', 'latitude', 'longitude', 'created_at']
        read_only_fields = ['id', 'created_at']


class TravelTimeSerializer(serializers.ModelSerializer):
    origin = LocationSerializer(read_only=True)
    origin_id = serializers.IntegerField(write_only=True)
    destination = LocationSerializer(read_only=True)
    destination_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = TravelTime
        fields = ['id', 'origin', 'origin_id', 'destination', 'destination_id', 'minutes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class RideAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for ride assignments (driver + car)."""
    driver = DriverSerializer(read_only=True)
    driver_id = serializers.IntegerField(write_only=True)
    car = CarSerializer(read_only=True)
    car_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = RideAssignment
        fields = ['id', 'driver', 'driver_id', 'car', 'car_id', 'has_departed', 'departed_at', 'created_at']
        read_only_fields = ['id', 'has_departed', 'departed_at', 'created_at']


class RideSerializer(serializers.ModelSerializer):
    origin = LocationSerializer(read_only=True)
    origin_id = serializers.IntegerField(write_only=True)
    destination = LocationSerializer(read_only=True)
    destination_id = serializers.IntegerField(write_only=True)
    assignments = RideAssignmentSerializer(many=True, read_only=True)
    available_seats = serializers.IntegerField(read_only=True)
    remaining_capacity = serializers.IntegerField(read_only=True)
    seats_remaining = serializers.IntegerField(read_only=True)
    reserved_seats = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    registration_open = serializers.BooleanField(read_only=True)

    class Meta:
        model = Ride
        fields = [
            'id', 'origin', 'origin_id', 'destination', 'destination_id',
            'departure_time', 'is_vip', 'assignments', 'available_seats',
            'remaining_capacity', 'seats_remaining', 'reserved_seats',
            'is_full', 'registration_open', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class RideListSerializer(serializers.ModelSerializer):
    """Simplified ride serializer for list views."""
    origin = LocationSerializer(read_only=True)
    destination = LocationSerializer(read_only=True)
    available_seats = serializers.IntegerField(read_only=True)
    seats_remaining = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    registration_open = serializers.BooleanField(read_only=True)
    all_departed = serializers.BooleanField(read_only=True)

    class Meta:
        model = Ride
        fields = [
            'id', 'origin', 'destination', 'departure_time',
            'available_seats', 'seats_remaining', 'is_full',
            'registration_open', 'is_vip', 'all_departed'
        ]


class ReservationSerializer(serializers.ModelSerializer):
    ride = RideListSerializer(read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = Reservation
        fields = [
            'id', 'ride', 'user', 'guest_email', 'guest_name',
            'status', 'added_by_admin', 'is_present', 'created_at', 'expires_at'
        ]
        read_only_fields = ['id', 'status', 'is_present', 'created_at', 'expires_at']


class ReservationCreateSerializer(serializers.Serializer):
    """Serializer for creating a reservation."""
    email = serializers.EmailField()
    name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=20)


class AdminAddPassengerSerializer(serializers.Serializer):
    """Serializer for admin to add a passenger to a ride."""
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField(required=False, allow_blank=True, default='')
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')


class DriverPassengerSerializer(serializers.ModelSerializer):
    """Serializer for drivers viewing passengers on their rides.

    Shows name, phone, and presence status - but not email.
    """
    name = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    marked_present_by_id = serializers.IntegerField(source='marked_present_by.id', read_only=True, allow_null=True)

    class Meta:
        model = Reservation
        fields = ['id', 'name', 'phone', 'status', 'is_present', 'marked_present_by_id', 'created_at']

    def get_name(self, obj):
        return obj.user.name if obj.user else obj.guest_name

    def get_phone(self, obj):
        return obj.user.phone if obj.user and obj.user.phone else obj.guest_phone


class PassengerSerializer(serializers.ModelSerializer):
    """Full serializer for admins viewing passengers on a ride.

    Includes all passenger data including email and phone.
    """
    email = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    marked_present_by_id = serializers.IntegerField(source='marked_present_by.id', read_only=True, allow_null=True)

    class Meta:
        model = Reservation
        fields = ['id', 'email', 'name', 'phone', 'status', 'added_by_admin', 'is_present', 'marked_present_by_id', 'created_at']

    def get_email(self, obj):
        return obj.user.email if obj.user else obj.guest_email

    def get_name(self, obj):
        return obj.user.name if obj.user else obj.guest_name

    def get_phone(self, obj):
        return obj.user.phone if obj.user and obj.user.phone else obj.guest_phone
