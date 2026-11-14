import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create or configure the Render admin user"

    def handle(self, *args, **options):
        username = os.environ.get("ADMIN_USERNAME")
        email = os.environ.get("ADMIN_EMAIL")
        password = os.environ.get("ADMIN_PASSWORD")

        if not all([username, email, password]):
            self.stdout.write(
                self.style.WARNING(
                    "Admin credentials not configured. Skipping."
                )
            )
            return

        User = get_user_model()

        user = User.objects.filter(username=username).first()

        if user is None:
            user = User(username=username)
            user.set_password(password)
            self.stdout.write("Creating new admin user...")
        else:
            self.stdout.write("Updating existing admin permissions...")

        user.email = email
        user.role = "admin"
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Admin user '{username}' is ready!"
            )
        )