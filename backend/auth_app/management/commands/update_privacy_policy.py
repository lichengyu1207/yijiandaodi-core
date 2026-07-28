from django.core.management.base import BaseCommand
import subprocess, sys, os
from datetime import datetime


class Command(BaseCommand):
    help = 'Update privacy policy and user agreement to v3.0 (compliant with PIPL/Data Security Law)'

    def handle(self, *args, **options):
        script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'seed_privacy_v3.py')
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True, text=True, cwd=os.path.dirname(script_path),
        )
        self.stdout.write(result.stdout)
        if result.stderr:
            self.stdout.write(self.style.WARNING(result.stderr))
        if result.returncode == 0:
            self.stdout.write(self.style.SUCCESS(f'\n[OK] Privacy Policy v3.0 & Terms v3.0 updated at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'))
        else:
            self.stdout.write(self.style.ERROR(f'Failed with exit code {result.returncode}'))
