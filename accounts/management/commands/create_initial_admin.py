"""Management command to create an initial admin user from environment variables."""
import os
from django.core.management.base import BaseCommand
from accounts.models import User


class Command(BaseCommand):
    help = 'Creates an initial admin user from environment variables if it does not exist'

    def handle(self, *args, **options):
        email = os.environ.get('ADMIN_EMAIL')
        name = os.environ.get('ADMIN_NAME', 'Admin')

        if not email:
            self.stdout.write(
                self.style.WARNING('ADMIN_EMAIL not set, skipping initial admin creation')
            )
            return

        # Check if user already exists
        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.SUCCESS(f'Admin user {email} already exists')
            )
            return

        # Create the admin user
        user = User.objects.create_user(
            email=email,
            name=name,
            role='admin',
            is_staff=True,
            is_superuser=True,
        )

        self.stdout.write(
            self.style.SUCCESS(f'Successfully created admin user: {email}')
        )

        # Generate and output a magic link token for first login
        token = user.generate_magic_token()
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
        self.stdout.write(
            self.style.SUCCESS(f'Login link: {frontend_url}/verify/{token}')
        )
