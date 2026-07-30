import sys, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

print('Step1: importing django...', flush=True)
import django
django.setup()
print('Step2: Django OK', flush=True)

print('Step3: importing p2p_app.views...', flush=True)
from p2p_app import views
print('Step4: views imported OK', flush=True)

# Try importing each service
services = [
    'orchestrator', 'security_gateway', 'cost_router',
    'heartbeat_service', 'discovery_service', 'task_state_machine',
    'task_scheduler', 'execution_engine', 'audit_trail', 'pipeline'
]
for s in services:
    try:
        __import__(f'p2p_app.services.{s}')
        print(f'  {s}: OK', flush=True)
    except Exception as e:
        print(f'  {s}: ERROR - {e}', flush=True)

print('ALL DONE', flush=True)
