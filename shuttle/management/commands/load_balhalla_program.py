from datetime import datetime

from django.core.management.base import BaseCommand
from django.db import transaction

from shuttle.models import FestivalProgramItem


PROGRAM_ITEMS = [
    # Main Stage, Friday 26 February
    {
        'title': 'Decombel - Van Mierlo',
        'location': 'Main stage',
        'description': (
            'Maarten Decombel and Toon Van Mierlo weave original compositions '
            'into an intimate, vibrant musical dialogue.'
        ),
        'start_time': '2027-02-26T19:30:00+01:00',
        'end_time': '2027-02-26T21:15:00+01:00',
    },
    {
        'title': 'Duo Also',
        'location': 'Main stage',
        'description': (
            "After Balhalla's Open Stage, Duo Also brings its captivating "
            'two-fiddle sound to the Main Stage.'
        ),
        'start_time': '2027-02-26T21:30:00+01:00',
        'end_time': '2027-02-26T23:15:00+01:00',
    },
    {
        'title': 'Hot Griselda',
        'location': 'Main stage',
        'description': (
            'Hot Griselda fuses Irish, Flemish and Breton roots with bouzouki '
            'grooves, melodic whirlwinds and full-on rock energy.'
        ),
        'start_time': '2027-02-26T23:30:00+01:00',
        'end_time': '2027-02-27T01:15:00+01:00',
    },
    {
        'title': 'Friday evening jam',
        'location': 'Main stage',
        'description': '',
        'start_time': '2027-02-27T01:20:00+01:00',
        'end_time': '2027-02-27T02:30:00+01:00',
    },
    # Main Stage, Saturday 27 February
    {
        'title': 'Diatocello',
        'location': 'Main stage',
        'description': (
            'Diatocello balances diatonic accordion and jazz cello in a refined, '
            'harmonious dialogue made for listening and dancing.'
        ),
        'start_time': '2027-02-27T14:00:00+01:00',
        'end_time': '2027-02-27T16:00:00+01:00',
    },
    {
        'title': 'Trio Loubelya',
        'location': 'Main stage',
        'description': (
            'Original balfolk trio blending neo-trad, jazz and world music across '
            'mazurkas, valses, bourrées, mixers and scottish.'
        ),
        'start_time': '2027-02-27T16:15:00+01:00',
        'end_time': '2027-02-27T18:15:00+01:00',
    },
    {
        'title': 'Duo Plodocus',
        'location': 'Main stage',
        'description': (
            'Duo Plodocus turns original compositions and traditional themes into '
            'a gentle, mischievous dance journey.'
        ),
        'start_time': '2027-02-27T18:30:00+01:00',
        'end_time': '2027-02-27T20:30:00+01:00',
    },
    {
        'title': 'Groove Factory',
        'location': 'Main stage',
        'description': (
            'Groove Factory explores traditional music through acoustic and '
            'electronic inspirations, creating a contemporary sound dialogue.'
        ),
        'start_time': '2027-02-27T20:45:00+01:00',
        'end_time': '2027-02-27T22:45:00+01:00',
    },
    {
        'title': 'Cardboard Cabin',
        'location': 'Main stage',
        'description': (
            'Cardboard Cabin blends warm folk, power energy, playful interaction '
            'and surprising turns into a dance soundscape.'
        ),
        'start_time': '2027-02-27T23:00:00+01:00',
        'end_time': '2027-02-28T01:00:00+01:00',
    },
    {
        'title': 'Saturday evening jam',
        'location': 'Main stage',
        'description': '',
        'start_time': '2027-02-28T01:20:00+01:00',
        'end_time': '2027-02-28T02:30:00+01:00',
    },
    # Main Stage, Sunday 28 February
    {
        'title': 'Nøkkenoc',
        'location': 'Main stage',
        'description': (
            'Nøkkenoc blends Occitan and Scandinavian traditions through '
            'nyckelharpa, vocals, guitar and cittern in groovy balfolk.'
        ),
        'start_time': '2027-02-28T12:00:00+01:00',
        'end_time': '2027-02-28T13:45:00+01:00',
    },
    {
        'title': 'Threo',
        'location': 'Main stage',
        'description': (
            'THREO brings high-energy balfolk: traditional dance music with '
            'contemporary grooves, beats, harmonies and improvisation.'
        ),
        'start_time': '2027-02-28T14:00:00+01:00',
        'end_time': '2027-02-28T15:45:00+01:00',
    },
    {
        'title': 'Duo Brotto Milleret',
        'location': 'Main stage',
        'description': (
            'Duo Brotto Milleret pairs two diatonic accordions with traditional '
            'tunes, original compositions and infectious dance rhythms.'
        ),
        'start_time': '2027-02-28T16:00:00+01:00',
        'end_time': '2027-02-28T17:45:00+01:00',
    },
    {
        'title': 'Rémi Geffroy',
        'location': 'Main stage',
        'description': (
            'Headliner Rémi Geffroy can bring an entire dance floor to life on '
            'his own with powerful diatonic accordion music.'
        ),
        'start_time': '2027-02-28T18:00:00+01:00',
        'end_time': '2027-02-28T19:45:00+01:00',
    },
    {
        'title': 'Saying goodbye',
        'location': 'Main stage',
        'description': (
            'Time for hugs and goodbyes. As our volunteer team starts packing up, '
            'we share one last laugh and secretly plan our next meeting.'
        ),
        'start_time': '2027-02-28T20:00:00+01:00',
        'end_time': '2027-02-28T20:15:00+01:00',
    },
    # Open Stage. The full lineup has not been published yet.
    {
        'title': 'Open Stage: Opening set',
        'location': 'Open stage',
        'description': (
            'The first Open Stage set, before the Main Stage programme begins. '
            'The rest of the Open Stage lineup is still to be announced.'
        ),
        'start_time': '2027-02-26T18:30:00+01:00',
        'end_time': '2027-02-26T19:30:00+01:00',
    },
    # Workshops, Friday 26 February
    {
        'title': 'Dance Initiation for beginners',
        'location': 'Workshops',
        'description': (
            "We cover the standard balfolk dances from the basics so you're fully "
            'prepared for the festival.'
        ),
        'start_time': '2027-02-26T18:30:00+01:00',
        'end_time': '2027-02-26T19:30:00+01:00',
    },
    # Workshops, Saturday 27 February
    {
        'title': 'Dance workshop 1',
        'location': 'Workshops',
        'description': 'Space for dancing, space for comfort, space for one another.',
        'start_time': '2027-02-27T10:00:00+01:00',
        'end_time': '2027-02-27T12:00:00+01:00',
    },
    {
        'title': 'Dance workshop 2',
        'location': 'Workshops',
        'description': 'Once again, we give space to dancing with respect for boundaries.',
        'start_time': '2027-02-27T10:00:00+01:00',
        'end_time': '2027-02-27T12:00:00+01:00',
    },
    {
        'title': 'Music workshop 1',
        'location': 'Workshops',
        'description': 'No virtuosity needed, just a little curiosity. Registration required.',
        'start_time': '2027-02-27T10:00:00+01:00',
        'end_time': '2027-02-27T12:00:00+01:00',
    },
    {
        'title': 'Dance workshop 3',
        'location': 'Workshops',
        'description': 'Just like last year: space for learning, practicing and discovering.',
        'start_time': '2027-02-27T12:00:00+01:00',
        'end_time': '2027-02-27T14:00:00+01:00',
    },
    {
        'title': 'Dance workshop 4',
        'location': 'Workshops',
        'description': (
            'Balfolk in all its forms — once again translated into warm workshop sessions.'
        ),
        'start_time': '2027-02-27T12:00:00+01:00',
        'end_time': '2027-02-27T14:00:00+01:00',
    },
    {
        'title': 'Music workshop 2',
        'location': 'Workshops',
        'description': (
            'For anyone keen to make, learn and listen to music together. '
            'Registration required.'
        ),
        'start_time': '2027-02-27T12:00:00+01:00',
        'end_time': '2027-02-27T14:00:00+01:00',
    },
    # Workshops, Sunday 28 February
    {
        'title': 'Dance workshop 5',
        'location': 'Workshops',
        'description': 'Whether it’s your first time dancing or your fiftieth: welcome!',
        'start_time': '2027-02-28T10:00:00+01:00',
        'end_time': '2027-02-28T12:00:00+01:00',
    },
    {
        'title': 'Dance workshop 6',
        'location': 'Workshops',
        'description': 'Once again, expect room not only to dance better, but more mindfully.',
        'start_time': '2027-02-28T10:00:00+01:00',
        'end_time': '2027-02-28T12:00:00+01:00',
    },
    {
        'title': 'Music workshop 3',
        'location': 'Workshops',
        'description': (
            "Whether you’re just starting out or have played for years: there’s room "
            'for your sound here. Registration required.'
        ),
        'start_time': '2027-02-28T10:00:00+01:00',
        'end_time': '2027-02-28T12:00:00+01:00',
    },
    {
        'title': 'Dance workshop 7',
        'location': 'Workshops',
        'description': 'Workshops that reflect our vision: connecting, deepening, surprising.',
        'start_time': '2027-02-28T12:00:00+01:00',
        'end_time': '2027-02-28T14:00:00+01:00',
    },
]


class Command(BaseCommand):
    help = 'Load the published Balhalla Festival 2027 program into the timeline.'

    @transaction.atomic
    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for item in PROGRAM_ITEMS:
            start_time = datetime.fromisoformat(item['start_time'])
            end_time = datetime.fromisoformat(item['end_time'])
            _, created = FestivalProgramItem.objects.update_or_create(
                title=item['title'],
                location=item['location'],
                defaults={
                    'description': item['description'],
                    'start_time': start_time,
                    'end_time': end_time,
                },
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Loaded Balhalla program: {created_count} created, '
                f'{updated_count} updated.'
            )
        )
