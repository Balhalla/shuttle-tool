"""
Django settings for shuttle project.
"""
import os
from pathlib import Path
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: don't run with debug turned on in production!
# Default to False for security - explicitly set to True for development
DEBUG = os.environ.get('DJANGO_DEBUG', 'False').lower() == 'true'

# SECURITY WARNING: keep the secret key used in production secret!
# In production, always set DJANGO_SECRET_KEY environment variable
_secret_key = os.environ.get('DJANGO_SECRET_KEY', '')
if not _secret_key:
    # In production mode, refuse to start without a secret key
    if not DEBUG:
        raise ValueError(
            'DJANGO_SECRET_KEY environment variable must be set in production. '
            'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(64))"'
        )
    # In development, warn and use insecure default
    import warnings
    warnings.warn(
        'DJANGO_SECRET_KEY not set! Using insecure default. '
        'Set DJANGO_SECRET_KEY environment variable in production.',
        UserWarning
    )
    _secret_key = 'insecure-dev-key-only-for-local-development'
SECRET_KEY = _secret_key

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'corsheaders',
    # Local apps
    'accounts',
    'shuttle',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database configuration
# Use DATABASE_URL env var for PostgreSQL, fallback to SQLite for local dev
DATABASES = {
    'default': dj_database_url.config(
        default=f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        conn_max_age=600,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

AUTH_USER_MODEL = 'accounts.User'

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Europe/Brussels'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS settings
# For production, explicitly set CORS_ALLOWED_ORIGINS environment variable
# Development defaults are provided for convenience
_cors_default = 'http://localhost:3000,http://localhost:5173,http://localhost' if DEBUG else ''
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', _cors_default).split(',') if os.environ.get('CORS_ALLOWED_ORIGINS', _cors_default) else []
CORS_ALLOW_CREDENTIALS = True

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'accounts.authentication.MagicTokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'EXCEPTION_HANDLER': 'shuttle.exceptions.custom_exception_handler',
}

# Email settings
# Options:
#   1. Console (dev): django.core.mail.backends.console.EmailBackend
#   2. SMTP: django.core.mail.backends.smtp.EmailBackend
#   3. Scaleway TEM: accounts.email_backends.ScalewayEmailBackend
EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False').lower() == 'true'
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@shuttle.local')

# Scaleway TEM settings (for accounts.email_backends.ScalewayEmailBackend)
SCALEWAY_SECRET_KEY = os.environ.get('SCALEWAY_SECRET_KEY', '')
SCALEWAY_PROJECT_ID = os.environ.get('SCALEWAY_PROJECT_ID', '')
SCALEWAY_TEM_REGION = os.environ.get('SCALEWAY_TEM_REGION', 'fr-par')

# Magic link settings
MAGIC_LINK_EXPIRY_MINUTES = 60
SESSION_TOKEN_EXPIRY_DAYS = 7
RESERVATION_EXPIRY_MINUTES = 15
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

# App configuration
APP_TITLE = os.environ.get('APP_TITLE', 'Shuttle')
FAVICON_URL = os.environ.get('FAVICON_URL', '')
DEMO_SITE = os.environ.get('DEMO_SITE', 'False').lower() == 'true'

# Discord webhook (optional)
DISCORD_WEBHOOK_URL = os.environ.get('DISCORD_WEBHOOK_URL', '')

# Security settings for production
# These are safe to enable in development as well
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'

# HTTPS settings - only enforce in production
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# Request size limits to prevent DoS
DATA_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5 MB
