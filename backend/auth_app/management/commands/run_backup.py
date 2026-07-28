from django.core.management.base import BaseCommand
import subprocess, sys, os
from datetime import datetime


class Command(BaseCommand):
    help = 'Run full backup (DB + media + logs + JSON export) with disaster recovery support'

    def add_arguments(self, parser):
        parser.add_argument('--type', choices=['daily', 'weekly', 'monthly', 'manual'], default='daily')
        parser.add_argument('--cleanup-only', action='store_true')
        parser.add_argument('--list', action='store_true')

    def handle(self, *args, **options):
        script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'backup_manager.py')

        cmd = [sys.executable, script_path]
        if options['type']:
            cmd.extend(['--type', options['type']])
        if options['cleanup_only']:
            cmd.append('--cleanup-only')
        if options['list']:
            cmd.append('--list')

        result = subprocess.run(cmd, capture_output=True, text=True)
        self.stdout.write(result.stdout)
        if result.stderr:
            self.stdout.write(self.style.WARNING(result.stderr))
        if result.returncode == 0 and not options.get('list') and not options.get('cleanup_only'):
            self.stdout.write(self.style.SUCCESS(f'\n[OK] Backup completed at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'))
