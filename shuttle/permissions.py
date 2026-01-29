"""Custom permissions for shuttle app."""
from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allow access only to admin users."""

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'admin'
        )


class IsDriver(BasePermission):
    """Allow access only to driver users."""

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role == 'driver'
        )


class IsDriverOrAdmin(BasePermission):
    """Allow access to drivers or admins."""

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role in ['driver', 'admin']
        )
