"""Verified actual API + unchanged Database bootstrap; local Unix socket only."""
import argparse
import getpass
import hashlib
import importlib.util
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
API = HERE.parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--database-repo', type=pathlib.Path)
    parser.add_argument('--pg-bin', type=pathlib.Path)
    parser.add_argument('--evidence-dir', type=pathlib.Path, required=True)
    parser.add_argument('--worker', type=pathlib.Path)
    args = parser.parse_args()
    pins = json.loads((HERE / 'sources.json').read_text())
    if args.worker:
        spec = importlib.util.spec_from_file_location('sites_bootstrap', args.worker / 'proposals/sites-publish-evidence-2094/test_contract.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        fixture = module.SitesEvidence
        try:
            fixture.setUpClass()
            socket = pathlib.Path(fixture.tmp.name).resolve()
            marker = {'offline_only': True, 'database_commit': pins['database_commit'], 'socket': str(socket), 'user': getpass.getuser()}
            (socket / 'sites-bridge.json').write_text(json.dumps(marker))
            env = {key: os.environ[key] for key in ('PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'USER', 'LOGNAME')}
            env.update(SITES_BRIDGE_SOCKET=str(socket), SITES_BRIDGE_PSQL=shutil.which('psql'),
                       SITES_BRIDGE_VECTORS=str(args.worker / 'proposals/sites-publish-evidence-2094/api-digest-vectors.json'),
                       SITES_BRIDGE_LOAD_LOG=str(args.evidence_dir / 'loader.json'))
            version = subprocess.check_output(['psql', '--version'], text=True).strip()
            print(json.dumps({'postgres': version, 'database_commit': pins['database_commit'], 'api_baseline_commit': pins['api_baseline_commit'], 'api_modified_from_baseline': pins['api_modified_from_baseline'], 'source_pins': 'matched', 'environment_keys': sorted(env)}), flush=True)
            result = subprocess.run(['node', str(API / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(HERE / 'vitest.bridge.config.ts')], cwd=API, env=env, timeout=180)
            if result.returncode:
                raise RuntimeError('Bridge qualification failed')
        finally:
            if hasattr(fixture, 'tmp'):
                log = pathlib.Path(fixture.tmp.name) / 'pg.log'
                if log.exists():
                    (args.evidence_dir / 'postgres.log').write_bytes(log.read_bytes())
            fixture.doClassCleanups()
        return
    if not args.database_repo or not args.pg_bin:
        parser.error('--database-repo and --pg-bin required')
    args.evidence_dir = args.evidence_dir.resolve()
    args.evidence_dir.mkdir(parents=True, exist_ok=True)
    for name, expected in pins['api_files'].items():
        if hashlib.sha256((API / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError('API source mismatch: ' + name)
    sources = {}
    git = shutil.which('git')
    for name, expected in pins['database_files'].items():
        data = subprocess.check_output([git, '-C', str(args.database_repo), 'show', pins['database_commit'] + ':' + name], env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent', 'LANG': 'C'})
        if hashlib.sha256(data).hexdigest() != expected:
            raise RuntimeError('Database source mismatch: ' + name)
        sources[name] = data
    with tempfile.TemporaryDirectory(prefix='sites-bridge-', dir=str(pathlib.Path('/tmp').resolve())) as directory:
        temp = pathlib.Path(directory)
        for name, data in sources.items():
            path = temp / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        # Never inherit service credentials, hosted DSNs, PG options, Node options or dotenv.
        env = {'PATH': os.pathsep.join([str(args.pg_bin.resolve()), str(pathlib.Path(shutil.which('node')).parent), '/usr/bin', '/bin']),
               'HOME': directory, 'TMPDIR': directory, 'LANG': 'en_US.UTF-8' if sys.platform == 'darwin' else 'C.UTF-8', 'LC_ALL': 'en_US.UTF-8' if sys.platform == 'darwin' else 'C.UTF-8', 'USER': getpass.getuser(), 'LOGNAME': getpass.getuser()}
        result = subprocess.run([sys.executable, str(HERE / 'run.py'), '--worker', directory, '--evidence-dir', str(args.evidence_dir)], env=env, timeout=240)
        if result.returncode:
            raise RuntimeError('Isolated bridge worker failed')


if __name__ == '__main__':
    main()
