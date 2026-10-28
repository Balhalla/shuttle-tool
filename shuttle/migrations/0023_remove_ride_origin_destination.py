from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('shuttle', '0022_ride_stops_and_reservation_segments')]

    operations = [
        migrations.RemoveField(model_name='ride', name='origin'),
        migrations.RemoveField(model_name='ride', name='destination'),
    ]
