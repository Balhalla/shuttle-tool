"""Custom User model with magic link authentication."""
import hashlib
import secrets
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
from datetime import timedelta
from django.conf import settings


def hash_token(token):
    """Hash a token using SHA-256 for secure storage.

    Since tokens are high-entropy (48 bytes from secrets.token_urlsafe),
    unsalted SHA-256 is sufficient — no rainbow table risk.
    """
    return hashlib.sha256(token.encode()).hexdigest()


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
        """Generate a new magic token for email authentication (one-time use).

        Returns the raw token (for use in URLs/emails).
        Stores the SHA-256 hash in the database.
        """
        raw_token = secrets.token_urlsafe(48)
        self.magic_token = hash_token(raw_token)
        expiry_minutes = getattr(settings, 'MAGIC_LINK_EXPIRY_MINUTES', 60)
        self.magic_token_expires_at = timezone.now() + timedelta(minutes=expiry_minutes)
        self.save(update_fields=['magic_token', 'magic_token_expires_at'])
        return raw_token

    def verify_magic_token(self, token):
        """Verify a magic token and clear it if valid (one-time use)."""
        if not self.magic_token or self.magic_token != hash_token(token):
            return False
        if self.magic_token_expires_at and timezone.now() > self.magic_token_expires_at:
            return False
        # Clear the magic token after successful verification
        self.magic_token = None
        self.magic_token_expires_at = None
        self.save(update_fields=['magic_token', 'magic_token_expires_at'])
        return True

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


class SessionToken(models.Model):
    """Session tokens for API authentication. Multiple tokens per user supported."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='session_tokens')
    token = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'session_tokens'

    def __str__(self):
        return f"Session for {self.user.email} (expires {self.expires_at})"

    @classmethod
    def create_for_user(cls, user):
        """Create a new session token for a user. Returns the raw token."""
        raw_token = secrets.token_urlsafe(48)
        expiry_days = getattr(settings, 'SESSION_TOKEN_EXPIRY_DAYS', 7)
        cls.objects.create(
            user=user,
            token=hash_token(raw_token),
            expires_at=timezone.now() + timedelta(days=expiry_days),
        )
        return raw_token

    @classmethod
    def authenticate(cls, raw_token):
        """Look up a user by raw token. Returns the user or None."""
        try:
            session = cls.objects.select_related('user').get(token=hash_token(raw_token))
            if timezone.now() > session.expires_at:
                session.delete()
                return None
            return session.user
        except cls.DoesNotExist:
            return None
