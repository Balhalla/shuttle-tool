from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shuttle', '0017_sitesettings_day_change_time'),
    ]

    operations = [
        migrations.CreateModel(
            name='FestivalProgramItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('location', models.CharField(blank=True, default='', max_length=255)),
                ('description', models.TextField(blank=True, default='')),
                ('start_time', models.DateTimeField()),
                ('end_time', models.DateTimeField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'festival_program_items',
                'ordering': ['start_time', 'title'],
            },
        ),
    ]
