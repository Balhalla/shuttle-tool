import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shuttle', '0020_location_short_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='reservation',
            name='seats',
            field=models.PositiveIntegerField(
                default=1,
                validators=[django.core.validators.MinValueValidator(1)],
            ),
        ),
    ]
