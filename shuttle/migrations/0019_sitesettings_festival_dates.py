import datetime
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shuttle', '0018_festivalprogramitem'),
    ]

    operations = [
        migrations.AddField(
            model_name='sitesettings',
            name='festival_start_date',
            field=models.DateField(default=datetime.date(2027, 2, 26)),
        ),
        migrations.AddField(
            model_name='sitesettings',
            name='festival_end_date',
            field=models.DateField(default=datetime.date(2027, 2, 28)),
        ),
    ]
