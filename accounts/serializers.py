"""Serializers for accounts app."""
from rest_framework import serializers
from .models import User, DriverAvailability


class CarNestedSerializer(serializers.Serializer):
    """Minimal car serializer to avoid circular imports."""
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    capacity = serializers.IntegerField(read_only=True)
    license_plate = serializers.CharField(read_only=True)


class UserSerializer(serializers.ModelSerializer):
    default_car = CarNestedSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'role', 'phone', 'default_car', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserCreateSerializer(serializers.ModelSerializer):
    default_car_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['email', 'name', 'role', 'phone', 'default_car_id']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class DriverSerializer(serializers.ModelSerializer):
    default_car = CarNestedSerializer(read_only=True)
    default_car_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'phone', 'default_car', 'default_car_id', 'created_at']
        read_only_fields = ['id', 'created_at']


class AdminUserSerializer(serializers.ModelSerializer):
    """Serializer for admin user management with role changes."""
    default_car = CarNestedSerializer(read_only=True)
    default_car_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'role', 'phone', 'default_car', 'default_car_id', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class RequestMagicLinkSerializer(serializers.Serializer):
    email = serializers.EmailField()


class VerifyTokenSerializer(serializers.Serializer):
    token = serializers.CharField()


class DriverAvailabilitySerializer(serializers.ModelSerializer):
    driver = DriverSerializer(read_only=True)
    driver_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = DriverAvailability
        fields = ['id', 'driver', 'driver_id', 'start_time', 'end_time', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        if data.get('start_time') and data.get('end_time'):
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError("End time must be after start time")
        return data
