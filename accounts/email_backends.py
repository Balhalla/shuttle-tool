"""Custom email backends for various providers."""
import json
import requests
from django.core.mail.backends.base import BaseEmailBackend
from django.conf import settings


class ScalewayEmailBackend(BaseEmailBackend):
    """
    Email backend for Scaleway Transactional Email (TEM) API.

    Required settings:
    - SCALEWAY_SECRET_KEY: Your Scaleway API secret key
    - SCALEWAY_PROJECT_ID: Your Scaleway project ID
    - SCALEWAY_TEM_REGION: Region for TEM (default: fr-par)
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.secret_key = getattr(settings, 'SCALEWAY_SECRET_KEY', '')
        self.project_id = getattr(settings, 'SCALEWAY_PROJECT_ID', '')
        self.region = getattr(settings, 'SCALEWAY_TEM_REGION', 'fr-par')
        self.api_url = f'https://api.scaleway.com/transactional-email/v1alpha1/regions/{self.region}/emails'

    def send_messages(self, email_messages):
        """Send one or more EmailMessage objects and return the number sent."""
        if not email_messages:
            return 0

        if not self.secret_key or not self.project_id:
            if not self.fail_silently:
                raise ValueError("SCALEWAY_SECRET_KEY and SCALEWAY_PROJECT_ID are required")
            return 0

        num_sent = 0
        for message in email_messages:
            try:
                sent = self._send(message)
                if sent:
                    num_sent += 1
            except Exception as e:
                if not self.fail_silently:
                    raise e

        return num_sent

    def _send(self, message):
        """Send a single EmailMessage."""
        headers = {
            'X-Auth-Token': self.secret_key,
            'Content-Type': 'application/json',
        }

        # Build the payload
        payload = {
            'project_id': self.project_id,
            'from': {
                'email': message.from_email,
            },
            'to': [{'email': email} for email in message.to],
            'subject': message.subject,
            'text': message.body,
        }

        # Add CC if present
        if message.cc:
            payload['cc'] = [{'email': email} for email in message.cc]

        # Add BCC if present
        if message.bcc:
            payload['bcc'] = [{'email': email} for email in message.bcc]

        # Add HTML content if present
        if hasattr(message, 'alternatives') and message.alternatives:
            for content, mimetype in message.alternatives:
                if mimetype == 'text/html':
                    payload['html'] = content
                    break

        response = requests.post(
            self.api_url,
            headers=headers,
            data=json.dumps(payload),
            timeout=30
        )

        if response.status_code not in (200, 201):
            if not self.fail_silently:
                raise Exception(f"Scaleway TEM API error: {response.status_code} - {response.text}")
            return False

        return True
