"""Custom authentication for session tokens."""
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.utils import timezone
from .models import User


class SessionTokenAuthentication(BaseAuthentication):
    """
    Custom authentication using session tokens.
    Expects header: Authorization: Bearer <token>

    Session tokens are separate from magic link tokens:
    - Magic tokens: one-time use for email verification, short expiry
    - Session tokens: used for API authentication, long-lived
    """
    keyword = 'Bearer'

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith(f'{self.keyword} '):
            return None

        token = auth_header[len(self.keyword) + 1:]

        if not token:
            return None

        try:
            user = User.objects.get(session_token=token)

            if user.session_token_expires_at and timezone.now() > user.session_token_expires_at:
                raise AuthenticationFailed('Session has expired')

            return (user, token)
        except User.DoesNotExist:
            return None

    def authenticate_header(self, request):
        return self.keyword


# Alias for backwards compatibility
MagicTokenAuthentication = SessionTokenAuthentication
