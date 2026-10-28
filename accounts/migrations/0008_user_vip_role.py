from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_sessiontoken_remove_user_session_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('public', 'Public'),
                    ('vip', 'VIP'),
                    ('driver', 'Driver'),
                    ('admin', 'Admin'),
                ],
                default='public',
                max_length=10,
            ),
        ),
    ]
