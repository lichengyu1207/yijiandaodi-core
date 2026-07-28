import os
import sys
import json
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from auth_app.rbac_models import Role, Permission, Menu
from auth_app.models import User


def load_texts():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(base_dir, 'rbac_init_texts.json')
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def create_roles(texts):
    roles_data = texts.get('roles', {})
    roles = {}
    for code, info in roles_data.items():
        role, created = Role.objects.get_or_create(
            code=code,
            defaults={
                'name': info.get('name', code),
                'description': info.get('description', ''),
                'data_scope': info.get('data_scope', 'self'),
                'sort_order': info.get('sort_order', 0),
            }
        )
        roles[code] = role
        status = 'created' if created else 'exists'
        print(f"  [{status}] {role.name} ({code})")
    return roles


def create_permissions(texts):
    perms_data = texts.get('permissions', [])
    perms_map = {}

    for perm_info in perms_data:
        parent_code = perm_info.get('parent')
        parent = perms_map.get(parent_code) if parent_code else None

        perm, created = Permission.objects.get_or_create(
            code=perm_info['code'],
            defaults={
                'name': perm_info.get('name', perm_info['code']),
                'perm_type': perm_info.get('type', 'menu'),
                'parent': parent,
                'path': perm_info.get('path', ''),
                'method': perm_info.get('method', ''),
                'component': perm_info.get('component', ''),
                'icon': perm_info.get('icon', ''),
                'sort_order': perm_info.get('sort_order', 0),
                'visible': perm_info.get('visible', True),
            }
        )
        perms_map[perm_info['code']] = perm
        status = 'created' if created else 'exists'
        print(f"  [{status}] {perm.name} ({perm_info['code']})")

    return perms_map


def create_menus(texts):
    menus_data = texts.get('menus', [])
    menus_map = {}
    perms_map = {p.code: p for p in Permission.objects.all()}

    for menu_info in menus_data:
        parent_code = menu_info.get('parent')
        parent = menus_map.get(parent_code) if parent_code else None
        perm = perms_map.get(menu_info.get('permission')) if menu_info.get('permission') else None

        menu, created = Menu.objects.get_or_create(
            code=menu_info['code'],
            defaults={
                'name': menu_info.get('name', menu_info['code']),
                'menu_type': menu_info.get('type', 'menu'),
                'parent': parent,
                'path': menu_info.get('path', ''),
                'component': menu_info.get('component', ''),
                'icon': menu_info.get('icon', ''),
                'permission': perm,
                'sort_order': menu_info.get('sort_order', 0),
                'visible': menu_info.get('visible', True),
            }
        )
        menus_map[menu_info['code']] = menu
        status = 'created' if created else 'exists'
        print(f"  [{status}] {menu.name} ({menu_info['code']})")

    return menus_map


def assign_permissions_to_roles(roles, perms_map, texts):
    assignments = texts.get('role_permissions', {})

    for role_code, perm_codes in assignments.items():
        role = roles.get(role_code)
        if not role:
            continue
        perms = [perms_map.get(code) for code in perm_codes]
        perms = [p for p in perms if p is not None]
        if perms:
            role.permissions.set(perms)
            print(f"  Assigned {len(perms)} permissions to {role.name}")


def assign_menus_to_roles(roles, menus_map, texts):
    assignments = texts.get('role_menus', {})

    for role_code, menu_codes in assignments.items():
        role = roles.get(role_code)
        if not role:
            continue
        menus = [menus_map.get(code) for code in menu_codes]
        menus = [m for m in menus if m is not None]
        if menus:
            role.menus.set(menus)
            print(f"  Assigned {len(menus)} menus to {role.name}")


def assign_admin_user(roles):
    try:
        admin_user = User.objects.filter(username='admin').first()
        if admin_user:
            super_admin_role = roles.get('super_admin')
            if super_admin_role:
                admin_user.roles.add(super_admin_role)
                print(f"\n  Admin user assigned to super_admin role")
    except Exception as e:
        print(f"\n  Warning: Could not assign admin user: {e}")


def main():
    print("=" * 50)
    print("RBAC Initialization Script")
    print("=" * 50)

    texts = load_texts()
    if not texts:
        print("\nError: rbac_init_texts.json file not found!")
        print("Please create the JSON file first with the required data structure.")
        return

    print("\n[1/6] Creating Roles...")
    roles = create_roles(texts)

    print("\n[2/6] Creating Permissions...")
    perms_map = create_permissions(texts)

    print("\n[3/6] Creating Menus...")
    menus_map = create_menus(texts)

    print("\n[4/6] Assigning Permissions to Roles...")
    assign_permissions_to_roles(roles, perms_map, texts)

    print("\n[5/6] Assigning Menus to Roles...")
    assign_menus_to_roles(roles, menus_map, texts)

    print("\n[6/6] Assigning Admin User...")
    assign_admin_user(roles)

    print("\n" + "=" * 50)
    print("RBAC Initialization Complete!")
    print("=" * 50)


if __name__ == '__main__':
    main()
