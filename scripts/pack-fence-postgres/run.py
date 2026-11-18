"""Explicit source-bound local paired test. No hosted credentials or TCP listener."""
import argparse
import hashlib
import json
import os
import pathlib
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--database', required=True, type=pathlib.Path)
parser.add_argument('--expected-binding', help='SHA256 from --print-binding; binds HEAD and file bytes, including dirty candidates')
parser.add_argument('--print-binding', action='store_true', help='Print source receipt without importing or running it')
args = parser.parse_args()
database = args.database.resolve()
proposal = database / 'proposals/pack-worker-fence-2269'
paths = sorted([*proposal.glob('*.py'), *proposal.glob('*.sql'), *database.glob('tests/*.py'),
                database / 'supabase/migrations/20260827050000_add_usage_events_resource_url.sql',
                database / 'supabase/migrations/20261020150000_release_pack_jobs.sql'])
assert all((proposal / name).is_file() for name in ['test_contract.py', 'schema.sql', 'command.sql', 'receipts.sql'])

def binding():
    head = subprocess.check_output(['git', '-C', str(database), 'rev-parse', 'HEAD'], text=True).strip()
    files = {str(path.relative_to(database)): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}
    receipt = {'head': head, 'files': files}
    digest = hashlib.sha256(json.dumps(receipt, sort_keys=True).encode()).hexdigest()
    return {**receipt, 'binding': digest}

receipt = binding()
if args.print_binding:
    print(json.dumps(receipt, indent=2))
    raise SystemExit(0)
if args.expected_binding != receipt['binding']:
    parser.error('Expected source binding missing or changed; inspect --print-binding and supply its binding')
print(json.dumps(receipt, sort_keys=True), flush=True)
# All fixture subprocesses, including initdb/psql, inherit only these local runtime settings.
env = {key: value for key, value in os.environ.items() if key in
       {'PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'SYSTEMROOT'}}
env['PYTHONDONTWRITEBYTECODE'] = '1'
os.environ.clear()
os.environ.update(env)
sys.path.insert(0, str(proposal))
from test_contract import FencedPacks
root = pathlib.Path(__file__).resolve().parents[2]
try:
    FencedPacks.setUpClass()
    env.update(PACK_FENCE_TEST_SOCKET=FencedPacks.tmp.name, PACK_FENCE_TEST_PORT='55476')
    result = subprocess.run(['pnpm', 'exec', 'vitest', 'run', 'lib/content/packs/fence/__tests__/packFencePostgres.test.ts'], cwd=root, env=env)
    if binding() != receipt:
        raise RuntimeError('Database source changed during qualification')
    raise SystemExit(result.returncode)
finally:
    FencedPacks.doClassCleanups()
    if FencedPacks.tearDown_exceptions:
        raise RuntimeError('Disposable PostgreSQL cleanup was not confirmed')
