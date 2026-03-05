"""Custom exception handlers for better error messages."""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django_ratelimit.exceptions import Ratelimited


def custom_exception_handler(exc, context):
    """Custom exception handler to provide better error messages."""
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)

    # Handle django-ratelimit's Ratelimited exception
    if isinstance(exc, Ratelimited):
        return Response(
            {'error': 'Too many requests. Please try again later.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    return response
