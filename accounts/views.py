"""Views for accounts app - magic link authentication."""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .models import User, hash_token
from .serializers import (
    UserSerializer, RequestMagicLinkSerializer, VerifyTokenSerializer
)


@api_view(['POST'])
@permission_classes([AllowAny])
def request_magic_link(request):
    """Request a magic link to be sent to email."""
    serializer = RequestMagicLinkSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data['email']

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Don't reveal if user exists or not
        return Response({'message': 'If this email exists, a magic link has been sent.'})

    token = user.generate_magic_token()

    # Build magic link URL
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
    magic_link = f"{frontend_url}/verify/{token}"

    # Send email
    send_mail(
        subject=f'Your {settings.APP_TITLE} Login Link',
        message=f'Click here to log in: {magic_link}\n\nThis link expires in {settings.MAGIC_LINK_EXPIRY_MINUTES} minutes.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )

    return Response({'message': 'If this email exists, a magic link has been sent.'})


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_token(request, token):
    """Verify a magic token and return user info with a session token."""
    try:
        with transaction.atomic():
            # Use select_for_update to prevent race conditions
            user = User.objects.select_for_update().get(magic_token=hash_token(token))

            # Check if token is expired
            if user.magic_token_expires_at and timezone.now() > user.magic_token_expires_at:
                return Response(
                    {'error': 'Token has expired'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Clear the magic token (one-time use)
            user.magic_token = None
            user.magic_token_expires_at = None
            user.save(update_fields=['magic_token', 'magic_token_expires_at'])

            # Generate a new session token for API authentication
            session_token = user.generate_session_token()

            return Response({
                'user': UserSerializer(user).data,
                'token': session_token,
            })
    except User.DoesNotExist:
        return Response(
            {'error': 'Invalid or expired token'},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_user(request):
    """Get the current authenticated user."""
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Logout by clearing the user's session token."""
    request.user.clear_session_token()
    return Response({'message': 'Logged out successfully'})
