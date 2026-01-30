"""Custom authentication for session tokens."""
from rest_framework.authentication import BaseAuthentication
from .models import SessionToken


class SessionTokenAuthentication(BaseAuthentication):
    """
    Custom authentication using session tokens.
    Expects header: Authorization: Bearer <token>
    """
    keyword = 'Bearer'

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith(f'{self.keyword} '):
            return None

        token = auth_header[len(self.keyword) + 1:]

        if not token:
            return None

        user = SessionToken.authenticate(token)
        if user is None:
            return None

        return (user, token)

    def authenticate_header(self, request):
        return self.keyword


# Alias for backwards compatibility
MagicTokenAuthentication = SessionTokenAuthentication
