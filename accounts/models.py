"""Custom User model with magic link authentication."""
import secrets
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from datetime import timedelta
from django.conf import settings


class UserManager(BaseUserManager):
    def create_user(self, email, name='', password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, name=name, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, name='', password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'admin')
        return self.create_user(email, name, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('public', 'Public'),
        ('driver', 'Driver'),
        ('admin', 'Admin'),
    ]

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='public')

    # Magic link fields (one-time use for email verification)
    magic_token = models.CharField(max_length=64, blank=True, null=True, unique=True)
    magic_token_expires_at = models.DateTimeField(blank=True, null=True)

    # Session token fields (for API authentication after login)
    session_token = models.CharField(max_length=64, blank=True, null=True, unique=True)
    session_token_expires_at = models.DateTimeField(blank=True, null=True)

    # Driver-specific fields
    phone = models.CharField(max_length=20, blank=True)
    default_car = models.ForeignKey(
        'shuttle.Car',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='drivers'
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.email

    def generate_magic_token(self):
        """Generate a new magic token for email authentication (one-time use)."""
        self.magic_token = secrets.token_urlsafe(48)
        expiry_minutes = getattr(settings, 'MAGIC_LINK_EXPIRY_MINUTES', 60)
        self.magic_token_expires_at = timezone.now() + timedelta(minutes=expiry_minutes)
        self.save(update_fields=['magic_token', 'magic_token_expires_at'])
        return self.magic_token

    def generate_session_token(self):
        """Generate a session token for API authentication (long-lived)."""
        self.session_token = secrets.token_urlsafe(48)
        expiry_days = getattr(settings, 'SESSION_TOKEN_EXPIRY_DAYS', 7)
        self.session_token_expires_at = timezone.now() + timedelta(days=expiry_days)
        self.save(update_fields=['session_token', 'session_token_expires_at'])
        return self.session_token

    def verify_magic_token(self, token):
        """Verify a magic token and clear it if valid (one-time use)."""
        if not self.magic_token or self.magic_token != token:
            return False
        if self.magic_token_expires_at and timezone.now() > self.magic_token_expires_at:
            return False
        # Clear the magic token after successful verification
        self.magic_token = None
        self.magic_token_expires_at = None
        self.save(update_fields=['magic_token', 'magic_token_expires_at'])
        return True

    def clear_session_token(self):
        """Clear the session token (logout)."""
        self.session_token = None
        self.session_token_expires_at = None
        self.save(update_fields=['session_token', 'session_token_expires_at'])

    @property
    def is_driver(self):
        return self.role == 'driver'

    @property
    def is_admin(self):
        return self.role == 'admin'


class DriverAvailability(models.Model):
    """Availability time slots for drivers."""
    driver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='availabilities',
        limit_choices_to={'role__in': ['driver', 'admin']}
    )
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'driver_availabilities'
        ordering = ['start_time']
        verbose_name_plural = 'Driver availabilities'

    def __str__(self):
        return f"{self.driver.name}: {self.start_time.strftime('%Y-%m-%d %H:%M')} - {self.end_time.strftime('%Y-%m-%d %H:%M')}"

    def contains_time(self, dt):
        """Check if a datetime falls within this availability window."""
        return self.start_time <= dt <= self.end_time
