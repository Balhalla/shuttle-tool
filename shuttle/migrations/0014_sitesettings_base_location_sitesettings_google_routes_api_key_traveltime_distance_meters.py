from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('shuttle', '0013_site_settings'),
    ]

    operations = [
        migrations.AddField(
            model_name='traveltime',
            name='distance_meters',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='google_routes_api_key',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='base_location',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='base_for_settings',
                to='shuttle.location',
            ),
        ),
    ]
