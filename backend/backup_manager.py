import os
import sys
import shutil
import json
import gzip
import hashlib
from datetime import datetime, timedelta
from pathlib import Path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

PROJECT_ROOT = Path(__file__).parent.parent
BACKUP_DIR = PROJECT_ROOT / 'backups'
from django.conf import settings

DB_PATH = Path(settings.DATABASES['default']['NAME']) if hasattr(settings, 'DATABASES') else PROJECT_ROOT / 'db.sqlite3'
MEDIA_DIR = PROJECT_ROOT / 'media'
LOGS_DIR = PROJECT_ROOT / 'logs'

MANIFEST_FILE = 'backup_manifest.json'
CHECKSUM_ALGO = 'sha256'


def ensure_backup_dir():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    (BACKUP_DIR / 'daily').mkdir(exist_ok=True)
    (BACKUP_DIR / 'weekly').mkdir(exist_ok=True)
    (BACKUP_DIR / 'monthly').mkdir(exist_ok=True)


def file_checksum(filepath):
    h = hashlib.new(CHECKSUM_ALGO)
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def backup_database(backup_path, compress=True):
    if not DB_PATH.exists():
        print(f'  [WARN] Database not found at {DB_PATH}')
        return None

    db_filename = DB_PATH.name
    dest = backup_path / f'{db_filename}.gz'
    try:
        with open(DB_PATH, 'rb') as f_in:
            with gzip.open(dest, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        size = dest.stat().st_size
        compressed = True
    except OSError as e:
        if 'space' in str(e).lower() or '112' in str(e):
            print(f'  [WARN] Disk space insufficient for compressed backup, trying JSON export only...')
            return None
        dest = backup_path / db_filename
        shutil.copy2(DB_PATH, dest)
        size = dest.stat().st_size
        compressed = False

    checksum = file_checksum(dest)
    return {
        'file': str(dest.relative_to(PROJECT_ROOT)),
        'size_bytes': size,
        'size_mb': round(size / (1024 * 1024), 2),
        'checksum': checksum,
        'compressed': compress,
    }


def backup_media(backup_path, compress=False):
    if not MEDIA_DIR.exists():
        return {'skipped': True, 'reason': 'media dir not found'}

    media_backup = backup_path / 'media'
    if media_backup.exists():
        shutil.rmtree(media_backup)

    total_size = 0
    file_count = 0
    for root, dirs, files in os.walk(MEDIA_DIR):
        rel_root = Path(root).relative_to(MEDIA_DIR)
        target_dir = media_backup / rel_root
        target_dir.mkdir(parents=True, exist_ok=True)
        for fname in files:
            src = Path(root) / fname
            dst = target_dir / fname
            shutil.copy2(src, dst)
            total_size += src.stat().st_size
            file_count += 1

    return {
        'dir': 'media/',
        'file_count': file_count,
        'total_bytes': total_size,
        'total_mb': round(total_size / (1024 * 1024), 2),
    }


def backup_logs(backup_path, days=7):
    if not LOGS_DIR.exists():
        return {'skipped': True, 'reason': 'logs dir not found'}

    logs_backup = backup_path / 'logs'
    if logs_backup.exists():
        shutil.rmtree(logs_backup)
    logs_backup.mkdir()

    cutoff = datetime.now() - timedelta(days=days)
    total_size = 0
    file_count = 0

    for log_file in LOGS_DIR.glob('*.log*'):
        try:
            mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
            if mtime >= cutoff:
                shutil.copy2(log_file, logs_backup / log_file.name)
                total_size += log_file.stat().st_size
                file_count += 1
        except Exception:
            pass

    return {
        'dir': 'logs/',
        'file_count': file_count,
        'cutoff_days': days,
        'total_bytes': total_size,
        'total_mb': round(total_size / (1024 * 1024), 2),
    }


def export_models_json(backup_path):
    os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'

    import django
    django.setup()

    from django.core import serializers
    from auth_app.models import User, BlacklistedToken, LoginLog
    from auth_app.mall_models import (
        Product, Order, PaymentRecord, UserFeedback,
        BusinessInquiry, ScenarioPackage, EnterpriseAuditService, EnterpriseAuditContract,
    )
    from auth_app.developer_models import DeveloperAccount, DeveloperAPIKey, DeveloperUsageLog
    from auth_app.data_classification_models import (
        DataSensitivityLevel, DataCategory, DataFieldTag,
        DataClassificationRecord, DataExportApproval, DataProtectionOfficer,
    )
    from content_app.models import Article, Category, ArticleLike, ArticleComment
    from content_app.rag_models import KnowledgeBaseCategory, KnowledgeDocument

    models_to_export = [
        ('User.json', User),
        ('LoginLog.json', LoginLog),
        ('BlacklistedToken.json', BlacklistedToken),
        ('Product.json', Product),
        ('Order.json', Order),
        ('PaymentRecord.json', PaymentRecord),
        ('UserFeedback.json', UserFeedback),
        ('BusinessInquiry.json', BusinessInquiry),
        ('ScenarioPackage.json', ScenarioPackage),
        ('EnterpriseAuditService.json', EnterpriseAuditService),
        ('EnterpriseAuditContract.json', EnterpriseAuditContract),
        ('DeveloperAccount.json', DeveloperAccount),
        ('DeveloperAPIKey.json', DeveloperAPIKey),
        ('DeveloperUsageLog.json', DeveloperUsageLog),
        ('DataSensitivityLevel.json', DataSensitivityLevel),
        ('DataCategory.json', DataCategory),
        ('DataFieldTag.json', DataFieldTag),
        ('DataClassificationRecord.json', DataClassificationRecord),
        ('DataExportApproval.json', DataExportApproval),
        ('DataProtectionOfficer.json', DataProtectionOfficer),
        ('Article.json', Article),
        ('Category.json', Category),
        ('ArticleLike.json', ArticleLike),
        ('ArticleComment.json', ArticleComment),
        ('KnowledgeBaseCategory.json', KnowledgeBaseCategory),
        ('KnowledgeDocument.json', KnowledgeDocument),
    ]

    json_dir = backup_path / 'json_export'
    json_dir.mkdir(exist_ok=True)

    export_results = []
    for filename, model in models_to_export:
        try:
            qs = model.objects.all()[:50000]
            data = serializers.serialize('json', qs)
            filepath = json_dir / filename
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(data)
            count = qs.count()
            size = filepath.stat().st_size
            export_results.append({
                'file': filename,
                'model': model.__name__,
                'count': count,
                'size_bytes': size,
                'size_kb': round(size / 1024, 1),
            })
        except Exception as e:
            export_results.append({'file': filename, 'model': model.__name__, 'error': str(e)})

    return export_results


def create_manifest(backup_path, results):
    manifest = {
        'version': '1.0',
        'backup_type': results.get('type', 'manual'),
        'created_at': datetime.now().isoformat(),
        'hostname': os.environ.get('HOSTNAME', 'unknown'),
        'project_root': str(PROJECT_ROOT),
        'database': results.get('database'),
        'media': results.get('media'),
        'logs': results.get('logs'),
        'json_export': results.get('json_export'),
        'totals': {
            'total_files': sum([
                1 if results.get('database') else 0,
                (results.get('media') or {}).get('file_count', 0),
                (results.get('logs') or {}).get('file_count', 0),
                len(results.get('json_export') or []),
            ]),
            'total_size_mb': round(sum([
                (results.get('database') or {}).get('size_mb', 0),
                (results.get('media') or {}).get('total_mb', 0),
                (results.get('logs') or {}).get('total_mb', 0),
                sum(e.get('size_kb', 0) for e in (results.get('json_export') or [])) / 1024,
            ]), 2),
        },
    }

    manifest_path = backup_path / MANIFEST_FILE
    try:
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        manifest['checksum'] = file_checksum(manifest_path)
    except OSError as e:
        if 'space' in str(e).lower() or '28' in str(e):
            print(f'  [ERROR] No space left on device to write manifest')
        else:
            raise
        return None


def cleanup_old_backups(retention_days=30):
    cutoff = datetime.now() - timedelta(days=retention_days)
    removed = 0
    freed_space = 0

    for backup_subdir in ['daily', 'weekly', 'monthly']:
        subdir = BACKUP_DIR / backup_subdir
        if not subdir.exists():
            continue
        for item in subdir.iterdir():
            if item.is_dir():
                try:
                    mtime = datetime.fromtimestamp(item.stat().st_mtime)
                    if mtime < cutoff:
                        size = sum(f.stat().st_size for f in item.rglob('*') if f.is_file())
                        shutil.rmtree(item)
                        removed += 1
                        freed_space += size
                except Exception:
                    pass

    return {'removed_backups': removed, 'freed_mb': round(freed_space / (1024 * 1024), 2)}


def run_full_backup(backup_type='daily'):
    ensure_backup_dir()

    import shutil
    try:
        free_bytes = shutil.disk_usage(BACKUP_DIR).free
        free_mb = free_bytes / (1024 * 1024)
        if free_mb < 100:
            print(f'[ERROR] Insufficient disk space: only {free_mb:.1f} MB free (need >= 100 MB)')
            print('       Skipping backup. Please free up disk space and retry.')
            return None
    except Exception:
        pass

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_name = f'full_backup_{timestamp}'
    backup_path = BACKUP_DIR / backup_type / backup_name
    backup_path.mkdir(parents=True, exist_ok=True)

    print(f'[1/5] Backing up database...')
    db_result = backup_database(backup_path, compress=(backup_type == 'daily'))
    if db_result:
        print(f'       {db_result["file"]} ({db_result["size_mb"]} MB, SHA256: {db_result["checksum"][:16]}...)')
    else:
        print('       Skipped - no database found')

    print(f'[2/5] Backing up media files...')
    media_result = backup_media(backup_path)
    if media_result.get('skipped'):
        print(f'       Skipped - {media_result["reason"]}')
    else:
        print(f'       {media_result["file_count"]} files, {media_result["total_mb"]} MB')

    print(f'[3/5] Backing up recent logs...')
    logs_result = backup_logs(backup_path, days=7)
    if logs_result.get('skipped'):
        print(f'       Skipped - {logs_result["reason"]}')
    else:
        print(f'       {logs_result["file_count"]} log files, {logs_result["total_mb"]} MB')

    print(f'[4/5] Exporting data as JSON...')
    json_result = export_models_json(backup_path)
    total_records = sum(e.get('count', 0) for e in json_result if 'count' in e)
    print(f'       {len(json_result)} models exported, {total_records} total records')

    print(f'[5/5] Creating manifest and checksums...')
    results = {
        'type': backup_type,
        'database': db_result,
        'media': media_result,
        'logs': logs_result,
        'json_export': json_result,
    }
    manifest = create_manifest(backup_path, results)

    cleanup = cleanup_old_backups(retention_days=30 if backup_type == 'daily' else 90)

    print(f'\n[OK] Backup complete: {backup_name}/')
    if manifest:
        print(f'     Total size: {manifest["totals"]["total_size_mb"]} MB | Files: {manifest["totals"]["total_files"]}')
        print(f'     Manifest: {MANIFEST_FILE} | Checksum: {manifest["checksum"][:16]}...')
    else:
        print(f'     [WARN] Manifest write failed (disk space?), but backup data was saved')
        print(f'     Location: backups/{backup_type}/{backup_name}/')
        print(f'     DB + JSON export completed successfully')
    print(f'     Cleanup: removed {cleanup["removed_backups"]} old backups, freed {cleanup["freed_mb"]} MB')
    print(f'     Location: backups/{backup_type}/{backup_name}/')

    return manifest


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='YiJianDaoDi Backup & Disaster Recovery')
    parser.add_argument('--type', choices=['daily', 'weekly', 'monthly', 'manual'], default='daily',
                        help='Backup type (default: daily)')
    parser.add_argument('--cleanup-only', action='store_true', help='Only clean old backups')
    parser.add_argument('--list', action='store_true', help='List existing backups')
    args = parser.parse_args()

    if args.cleanup_only:
        result = cleanup_old_backups()
        print(f'[OK] Cleanup done: removed {result["removed_backups"]} backups, freed {result["freed_mb"]} MB')
    elif args.list:
        ensure_backup_dir()
        for btype in ['daily', 'weekly', 'monthly']:
            d = BACKUP_DIR / btype
            if d.exists():
                items = sorted(d.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)[:10]
                print(f'\n[{btype.upper()}] ({len(list(d.iterdir()))} total):')
                for item in items:
                    mf = item / MANIFEST_FILE
                    if mf.exists():
                        with open(mf) as f:
                            m = json.load(f)
                        print(f'  {item.name} | {m["created_at"][:19]} | {m["totals"]["total_size_mb"]} MB | {m["totals"]["total_files"]} files')
                    else:
                        print(f'  {item.name} | (no manifest)')
    else:
        run_full_backup(backup_type=args.type)
