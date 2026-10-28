"""Serializers for shuttle app."""
from rest_framework import serializers
from django.db.models import Q
from django.utils import timezone
from .models import (
    Car,
    Location,
    TravelTime,
    Ride,
    RideAssignment,
    RideStop,
    Reservation,
    BlockedPeriod,
    FestivalProgramItem,
)
from accounts.serializers import UserSerializer, DriverSerializer


class CarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Car
        fields = ['id', 'name', 'license_plate', 'capacity', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']


class LocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Location
        fields = [
            'id', 'name', 'short_name', 'description', 'latitude', 'longitude',
            'created_at',
        ]
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
    car_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = RideAssignment
        fields = ['id', 'driver', 'driver_id', 'car', 'car_id', 'has_departed', 'departed_at', 'created_at']
        read_only_fields = ['id', 'has_departed', 'departed_at', 'created_at']


class RideStopSerializer(serializers.ModelSerializer):
    location = LocationSerializer(read_only=True)
    location_id = serializers.IntegerField(write_only=True, required=False)
    estimated_time = serializers.SerializerMethodField()

    class Meta:
        model = RideStop
        fields = ['position', 'location', 'location_id', 'estimated_time']
        read_only_fields = ['estimated_time']

    def get_estimated_time(self, obj):
        for item in obj.ride.stop_times():
            if item['position'] == obj.position:
                return item['time']
        return None


class RideSerializer(serializers.ModelSerializer):
    origin = LocationSerializer(read_only=True)
    origin_id = serializers.IntegerField(write_only=True, required=False)
    destination = LocationSerializer(read_only=True)
    destination_id = serializers.IntegerField(write_only=True, required=False)
    stops = RideStopSerializer(source='route_stops', many=True, read_only=True)
    stop_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    assignments = RideAssignmentSerializer(many=True, read_only=True)
    available_seats = serializers.IntegerField(read_only=True)
    remaining_capacity = serializers.IntegerField(read_only=True)
    seats_remaining = serializers.IntegerField(read_only=True)
    reserved_seats = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    registration_open = serializers.BooleanField(read_only=True)
    selected_seats_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Ride
        fields = [
            'id', 'origin', 'origin_id', 'destination', 'destination_id', 'stops', 'stop_ids',
            'departure_time', 'is_vip', 'is_deleted', 'assignments', 'available_seats',
            'remaining_capacity', 'seats_remaining', 'reserved_seats',
            'is_full', 'registration_open', 'created_at', 'selected_seats_remaining'
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        ids = attrs.get('stop_ids')
        if ids is None and ('origin_id' in attrs or 'destination_id' in attrs):
            ids = [attrs.get('origin_id'), attrs.get('destination_id')]
        if ids is None:
            return attrs
        if len(ids) < 2 or any(i is None for i in ids):
            raise serializers.ValidationError({'stop_ids': 'A route needs at least two stops.'})
        if ids[-1] == ids[0]:
            if len(ids) < 3 or len(set(ids[:-1])) != len(ids[:-1]):
                raise serializers.ValidationError({'stop_ids': 'Only the starting location may repeat, as the final stop.'})
        elif len(set(ids)) != len(ids):
            raise serializers.ValidationError({'stop_ids': 'Locations may not repeat except for a final return to the start.'})
        from .models import Location, TravelTime
        known = set(Location.objects.filter(id__in=ids).values_list('id', flat=True))
        if known != set(ids):
            raise serializers.ValidationError({'stop_ids': 'One or more locations do not exist.'})
        missing = [(a, b) for a, b in zip(ids, ids[1:]) if not TravelTime.objects.filter(origin_id=a, destination_id=b).exists()]
        if missing:
            raise serializers.ValidationError({'stop_ids': f'Missing configured travel time for stop pairs: {missing}'})
        attrs['stop_ids'] = ids
        return attrs

    def get_selected_seats_remaining(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        try:
            pickup = int(request.query_params.get('pickup_position', 0))
            dropoff = int(request.query_params.get('dropoff_position', len(obj.ordered_stops) - 1))
        except (TypeError, ValueError):
            return None
        if pickup >= dropoff or dropoff >= len(obj.ordered_stops):
            return None
        return obj.seats_remaining_for(pickup, dropoff)

    def create(self, validated_data):
        ids = validated_data.pop('stop_ids', None)
        if ids is None:
            ids = [validated_data.pop('origin_id'), validated_data.pop('destination_id')]
        else:
            validated_data.pop('origin_id', None)
            validated_data.pop('destination_id', None)
        ride = Ride.objects.create(origin_id=ids[0], destination_id=ids[-1], **validated_data)
        ride.route_stops.all().delete()
        for position, location_id in enumerate(ids):
            RideStop.objects.create(ride=ride, location_id=location_id, position=position)
        return ride

    def update(self, instance, validated_data):
        ids = validated_data.pop('stop_ids', None)
        validated_data.pop('origin_id', None)
        validated_data.pop('destination_id', None)
        if ids is not None:
            old_ids = [stop.location_id for stop in instance.ordered_stops]
            active_reservations = instance.reservations.filter(
                Q(status='confirmed') | Q(status='pending', expires_at__gt=timezone.now())
            )
            if ids != old_ids and active_reservations.exists():
                raise serializers.ValidationError({'stop_ids': 'Stops cannot be changed after passengers have booked.'})
            if ids != old_ids:
                instance.route_stops.all().delete()
                for position, location_id in enumerate(ids):
                    RideStop.objects.create(ride=instance, location_id=location_id, position=position)
        return super().update(instance, validated_data)


class RideListSerializer(serializers.ModelSerializer):
    """Simplified ride serializer for list views."""
    origin = LocationSerializer(read_only=True)
    destination = LocationSerializer(read_only=True)
    available_seats = serializers.IntegerField(read_only=True)
    seats_remaining = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)
    registration_open = serializers.BooleanField(read_only=True)
    all_departed = serializers.BooleanField(read_only=True)
    stops = RideStopSerializer(source='route_stops', many=True, read_only=True)
    seats_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Ride
        fields = [
            'id', 'origin', 'destination', 'departure_time',
            'available_seats', 'seats_remaining', 'is_full',
            'registration_open', 'is_vip', 'all_departed', 'is_deleted', 'stops'
        ]

    def get_seats_remaining(self, obj):
        request = self.context.get('request')
        if not request:
            return obj.seats_remaining
        pickup = request.query_params.get('pickup')
        dropoff = request.query_params.get('dropoff')
        if pickup and dropoff:
            positions = {}
            for stop in obj.ordered_stops:
                positions.setdefault(stop.location_id, []).append(stop.position)
            options = [obj.seats_remaining_for(a, b) for a in positions.get(int(pickup), []) for b in positions.get(int(dropoff), []) if a < b]
            if options:
                return max(options)
        return obj.seats_remaining


class ReservationSerializer(serializers.ModelSerializer):
    ride = RideListSerializer(read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = Reservation
        fields = [
            'id', 'ride', 'user', 'guest_email', 'guest_name',
            'seats', 'status', 'added_by_admin', 'is_present', 'created_at', 'expires_at',
            'pickup_position', 'dropoff_position'
        ]
        read_only_fields = ['id', 'status', 'is_present', 'created_at', 'expires_at']


class ReservationCreateSerializer(serializers.Serializer):
    """Serializer for creating a reservation."""
    email = serializers.EmailField()
    name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=20)
    seats = serializers.IntegerField(min_value=1, default=1)
    pickup_position = serializers.IntegerField(min_value=0, required=False, default=0)
    dropoff_position = serializers.IntegerField(min_value=1, required=False)


class AdminAddPassengerSerializer(serializers.Serializer):
    """Serializer for admin to add a passenger to a ride."""
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField(required=False, allow_blank=True, default='')
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default='')
    user_id = serializers.IntegerField(required=False, allow_null=True)
    seats = serializers.IntegerField(min_value=1, default=1)
    pickup_position = serializers.IntegerField(min_value=0, required=False, default=0)
    dropoff_position = serializers.IntegerField(min_value=1, required=False)


class DriverPassengerSerializer(serializers.ModelSerializer):
    """Serializer for drivers viewing passengers on their rides.

    Shows name, phone, and presence status - but not email.
    """
    name = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    marked_present_by_id = serializers.IntegerField(source='marked_present_by.id', read_only=True, allow_null=True)

    class Meta:
        model = Reservation
        fields = ['id', 'name', 'phone', 'seats', 'status', 'is_present', 'marked_present_by_id', 'created_at', 'pickup_position', 'dropoff_position']

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
        fields = ['id', 'email', 'name', 'phone', 'seats', 'status', 'added_by_admin', 'is_present', 'marked_present_by_id', 'created_at', 'pickup_position', 'dropoff_position']

    def get_email(self, obj):
        return obj.user.email if obj.user else obj.guest_email

    def get_name(self, obj):
        return obj.user.name if obj.user else obj.guest_name

    def get_phone(self, obj):
        return obj.user.phone if obj.user and obj.user.phone else obj.guest_phone


class BlockedPeriodSerializer(serializers.ModelSerializer):
    driver = DriverSerializer(read_only=True)
    driver_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = BlockedPeriod
        fields = ['id', 'driver', 'driver_id', 'start_time', 'end_time', 'reason', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class FestivalProgramItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FestivalProgramItem
        fields = [
            'id', 'title', 'location', 'description', 'start_time', 'end_time',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        start_time = data.get('start_time', getattr(self.instance, 'start_time', None))
        end_time = data.get('end_time', getattr(self.instance, 'end_time', None))
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError('End time must be after start time')
        return data
