"""Actual API adapter -> pinned disabled SQL. Disposable socket PG15/17 only."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

PIN = '5aff2df9ed853e671f044ffa5dc986099e622549'
RELATIVE = Path('proposals/catalog-weekly-storage-1867')
API = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-repo', type=Path, required=True)
    parser.add_argument('--pg-bin', type=Path, default=Path(os.environ.get('PG_BINDIR', '/opt/homebrew/opt/postgresql@17/bin')))
    args = parser.parse_args()
    repo = args.database_repo.resolve()
    # Fail before importing fixture code if local sources differ from accepted pin.
    for filename in ['test_disabled_storage.py', 'disabled-storage.sql']:
        relative = RELATIVE / filename
        pinned = subprocess.check_output(['git', '-C', str(repo), 'show', f'{PIN}:{relative}'])
        if (repo / relative).read_bytes() != pinned:
            raise SystemExit(f'Unqualified Database fixture: {relative}')
    version = subprocess.check_output([str(args.pg_bin / 'psql'), '--version'], text=True)
    if not any(f'PostgreSQL) {major}.' in version for major in [15, 17]):
        raise SystemExit('Use installed PostgreSQL15 or17 binaries')
    # Do not inherit libpq service/host/options variables from an operator environment.
    for key in list(os.environ):
        if key.startswith('PG'):
            del os.environ[key]
    os.environ['PG_BINDIR'] = str(args.pg_bin.resolve())
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location('pinned_catalog_fixture', repo / RELATIVE / 'test_disabled_storage.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    cls = module.DisabledStorage
    started = False
    try:
        cls.setUpClass()  # Reuse pinned dependency/RLS setup; do not run its unittest suite.
        started = True
        fixtures = []
        for _ in range(16):
            fixture = cls()
            fixture.setUp()
            fixtures.append({key: getattr(fixture, key) for key in ['actor', 'org', 'catalog', 'principal']})
        nonce = str(uuid.uuid4())
        Path(cls.tmp.name, 'integration-marker').write_text(nonce)
        metadata = Path(cls.tmp.name, 'adapter-fixtures.json')
        metadata.write_text(json.dumps({'socket_dir': cls.tmp.name, 'cluster': str(cls.cluster), 'port': 55476, 'pg_bin': str(args.pg_bin.resolve()), 'user': cls.sql('SELECT current_user'), 'nonce': nonce, 'fixtures': fixtures, 'sql_pin': PIN}))
        print(f'Local adapter integration: {version.strip()}, SQL {PIN}, {len(fixtures)} synthetic fixtures', flush=True)
        result = subprocess.run(['pnpm', 'exec', 'vitest', 'run', '--config', 'vitest.catalog-storage.config.ts'], cwd=API, env={**os.environ, 'CATALOG_STORAGE_FIXTURE': str(metadata)})
        if result.returncode:
            raise SystemExit(result.returncode)
    finally:
        cls.doClassCleanups()
        if cls.tearDown_exceptions:
            raise RuntimeError('Disposable cluster cleanup failed')
        print('Disposable PostgreSQL stopped and temporary files removed' if started else 'Fixture initialization failed; registered cleanup completed', flush=True)


if __name__ == '__main__':
    main()
