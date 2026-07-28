import urllib.request, json, sys

sys.stdout.reconfigure(encoding='utf-8')
base = 'http://localhost:8000'

def api(method, path, data=None, token=None):
    body = json.dumps(data).encode() if data else None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(f'{base}{path}', data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req)
        return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f'  HTTP {e.code}: {e.read().decode()[:300]}')
        return None

r = api('POST', '/api/auth/login/', {'username': 'admin', 'password': 'Admin@2026'})
token = r['data']['token']
print('=== logged in ===\n')

# Test 1: System Settings - Site Config
print('[Settings] Site Config')
r1 = api('GET', '/api/data/config/', token=token)
before = r1.get('data', [])
print(f'  before: {len(before)} configs')

r2 = api('PUT', '/api/data/config/', {
    'items': [
        {'key': 'site_name', 'value': 'YiJianDaoDi-V2', 'description': 'Site Name'},
        {'key': 'contact_email', 'value': 'hello@fangdudu.top', 'description': 'Contact Email'},
    ]
}, token=token)
saved = r2.get('success', False) if r2 else False
print(f'  save result: {saved}')

r3 = api('GET', '/api/data/config/', token=token)
after = r3.get('data', [])
for c in after:
    if c['key'] == 'site_name':
        ok = c['value'] == 'YiJianDaoDi-V2'
        print(f"  site_name = '{c['value']}' => {'PASS' if ok else 'FAIL'}")
    elif c['key'] == 'contact_email':
        ok = c['value'] == 'hello@fangdudu.top'
        print(f"  contact_email = '{c['value']}' => {'PASS' if ok else 'FAIL'}")

# Test 2: System Settings - Profile
print('\n[Settings] Profile Update')
r4 = api('GET', '/api/auth/userinfo/', token=token)
u0 = r4['data']
print(f"  before: email='{u0.get('email','')}'")

r5 = api('PUT', '/api/data/profile/', {
    'username': u0['username'],
    'email': 'updated@test.com',
}, token=token)
profile_ok = r5.get('success', False) if r5 else False
print(f'  update result: {profile_ok}')

r6 = api('GET', '/api/auth/userinfo/', token=token)
u1 = r6['data']
e_ok = u1.get('email') == 'updated@test.com'
print(f"  after: email='{u1.get('email','')}' => {'PASS' if e_ok else 'FAIL'}")

# restore
api('PUT', '/api/data/profile/', {'username': u0['username'], 'email': ''}, token=token)

# Test 3: Security - Password Change
print('\n[Security] Password Change')
r7 = api('PUT', '/api/auth/change-password/', {
    'old_password': 'WrongOldPass',
    'new_password': 'NewPass123',
}, token=token)
reject_ok = (r7 is None) or (not r7.get('success', True))
print(f'  wrong old password rejected: {reject_ok} => {"PASS" if reject_ok else "FAIL"}')

# Test 4: Security - Login Logs
print('\n[Security] Login Logs')
r8 = api('GET', '/api/auth/login-logs/', token=token)
logs = r8.get('data', [])
sc = sum(1 for l in logs if l.get('status') == 'success')
fc = sum(1 for l in logs if l.get('status') == 'failed')
print(f'  total={len(logs)} success={sc} failed={fc}')
if logs:
    latest = logs[-1]
    print(f"  latest: ip={latest.get('ip_address')} status={latest.get('status')} time={str(latest.get('login_time',''))[:19]}")

print('\n=== ALL TESTS DONE ===')
