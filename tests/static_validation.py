from pathlib import Path
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
SQL = ROOT / 'supabase' / 'migrations' / '001_initial_schema.sql'

runtime_js = ['app.js', 'church-info.js', 'config.js', 'demo-api.js', 'supabase-api.js']
for name in runtime_js:
    subprocess.run(['node', '--check', str(SITE / name)], check=True)

sql = SQL.read_text()
assert sql.count('$$') % 2 == 0, 'Unbalanced dollar-quoted SQL blocks'
assert sql.strip().endswith('commit;'), 'Migration must commit'

tables = [
    'profiles', 'private_profiles', 'teams', 'team_members', 'announcements', 'events',
    'prayer_requests', 'direct_conversations', 'direct_conversation_members', 'direct_messages',
    'team_notices', 'team_discussions', 'team_discussion_comments', 'activity_log'
]
for table in tables:
    assert f'create table if not exists public.{table}' in sql
    assert f'alter table public.{table} enable row level security;' in sql

assert 'SUPABASE_SECRET' not in (SITE / 'config.js').read_text()
assert 'service_role' not in (SITE / 'config.js').read_text()
assert 'ENABLE_DEMO_MODE: false' in (SITE / 'config.js').read_text()
assert '@supabase/supabase-js@2.110.8' in (SITE / 'index.html').read_text()
assert 'path: site' in (ROOT / '.github' / 'workflows' / 'deploy-pages.yml').read_text()

report = {
    'release': (ROOT / 'VERSION').read_text().strip(),
    'javascript_files_checked': runtime_js,
    'rls_tables_checked': tables,
    'supabase_js_version': '2.110.8',
    'demo_mode_enabled': False,
    'status': 'PASS'
}
(ROOT / 'tests' / 'static-validation-result.json').write_text(json.dumps(report, indent=2) + '\n')
print('PASS: static production validation')
