import os, sys, traceback
os.chdir(r'C:\MsSafeData\Desktop\yijiandaodi\backend')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
sys.path.insert(0, '.')
import django
django.setup()

out = open(r'C:\MsSafeData\Desktop\yijiandaodi\backend\seed_output.txt', 'w', encoding='utf-8')

try:
    out.write('Starting seed...\n')
    from content_app.management.commands.seed_articles import Command
    cmd = Command()
    
    class FakeStdout:
        def write(self, msg):
            out.write(str(msg))
            out.flush()
        def style_SUCCESS(self, msg):
            return self
        def __call__(self, msg):
            out.write(str(msg) + '\n')
    
    cmd.stdout = FakeStdout()
    cmd.handle()
    out.write('\nDone!\n')
except Exception as e:
    traceback.print_exc(file=out)
    out.write(f'ERROR: {e}\n')
finally:
    out.close()
print('Check seed_output.txt')
