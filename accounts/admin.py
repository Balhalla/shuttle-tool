"""Admin configuration for accounts app."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, DriverAvailability


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'name', 'role', 'is_active', 'created_at']
    list_filter = ['role', 'is_active', 'is_staff']
    search_fields = ['email', 'name']
    ordering = ['-created_at']

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('name', 'phone', 'default_car')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser')}),
        ('Magic link', {'fields': ('magic_token', 'token_expires_at')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'name', 'role', 'password1', 'password2'),
        }),
    )


@admin.register(DriverAvailability)
class DriverAvailabilityAdmin(admin.ModelAdmin):
    list_display = ['driver', 'start_time', 'end_time', 'created_at']
    list_filter = ['driver', 'start_time']
    search_fields = ['driver__name', 'driver__email']
    raw_id_fields = ['driver']
