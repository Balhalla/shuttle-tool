from django.db import migrations, models
import django.db.models.deletion


def seed_legacy_routes(apps, schema_editor):
    Ride = apps.get_model('shuttle', 'Ride')
    RideStop = apps.get_model('shuttle', 'RideStop')
    for ride in Ride.objects.all().iterator():
        RideStop.objects.create(ride_id=ride.id, location_id=ride.origin_id, position=0)
        RideStop.objects.create(ride_id=ride.id, location_id=ride.destination_id, position=1)


class Migration(migrations.Migration):
    dependencies = [('shuttle', '0021_reservation_seats')]

    operations = [
        migrations.CreateModel(
            name='RideStop',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('position', models.PositiveIntegerField()),
                ('location', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='ride_stops', to='shuttle.location')),
                ('ride', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='route_stops', to='shuttle.ride')),
            ],
            options={'db_table': 'ride_stops', 'ordering': ['position'], 'unique_together': {('ride', 'position')}},
        ),
        migrations.AddField(model_name='reservation', name='pickup_position', field=models.PositiveIntegerField(default=0)),
        migrations.AddField(model_name='reservation', name='dropoff_position', field=models.PositiveIntegerField(default=1)),
        migrations.RunPython(seed_legacy_routes, migrations.RunPython.noop),
    ]
