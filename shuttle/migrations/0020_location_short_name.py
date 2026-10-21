from django.db import migrations, models


SHORT_NAMES = {
    'Festival Grounds': 'FEST',
    'Camping North': 'CAMP',
    'Brussels-South Station': 'BRUS',
    'Grand Place': 'GRAN',
    'Volunteer Village': 'VOLS',
}


def populate_short_names(apps, schema_editor):
    Location = apps.get_model('shuttle', 'Location')
    for location in Location.objects.all():
        short_name = SHORT_NAMES.get(location.name)
        if not short_name:
            short_name = ''.join(
                character for character in location.name.upper()
                if character.isalnum()
            )[:4]
        location.short_name = short_name
        location.save(update_fields=['short_name'])


class Migration(migrations.Migration):

    dependencies = [
        ('shuttle', '0019_sitesettings_festival_dates'),
    ]

    operations = [
        migrations.AddField(
            model_name='location',
            name='short_name',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Compact name shown in the timeline',
                max_length=4,
            ),
        ),
        migrations.RunPython(populate_short_names, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='location',
            name='short_name',
            field=models.CharField(
                help_text='Compact name shown in the timeline',
                max_length=4,
            ),
        ),
    ]
