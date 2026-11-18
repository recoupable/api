"""Verified actual API + unchanged Database bootstrap; parent-owned local lifecycle."""
import argparse
import getpass
import hashlib
import importlib.util
import json
import os
import pathlib
import shutil
import signal
import subprocess
import sys
import tempfile
from verify_sources import verify_api, verify_database
from lifecycle import install_lifecycle, quiesce_worker, stop_owned_cluster

HERE = pathlib.Path(__file__).resolve().parent
API = HERE.parents[1]
FAULTS = ('missing-pid', 'startup', 'partial-bootstrap', 'blocked-sql', 'shutdown-error', 'shutdown-timeout')


def worker(args, pins):
    verify_api(API, pins)
    verify_database(args.worker, pins)
    if args.fail_before_bootstrap:
        os._exit(75)
    spec = importlib.util.spec_from_file_location('sites_bootstrap', args.worker / 'proposals/sites-publish-evidence-2094/test_contract.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    fixture = install_lifecycle(module, args.worker, args.fault)
    try:
        fixture.setUpClass()
        if args.fault:
            return  # Shutdown fault cases need no business test execution.
        socket = pathlib.Path(fixture.tmp.name).resolve()
        marker = {'offline_only': True, 'database_commit': pins['database_commit'], 'socket': str(socket), 'user': getpass.getuser()}
        (socket / 'sites-bridge.json').write_text(json.dumps(marker))
        env = {key: os.environ[key] for key in ('PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'USER', 'LOGNAME')}
        env.update(SITES_BRIDGE_SOCKET=str(socket), SITES_BRIDGE_PSQL=shutil.which('psql'),
                   SITES_BRIDGE_VECTORS=str(args.worker / 'proposals/sites-publish-evidence-2094/api-digest-vectors.json'),
                   SITES_BRIDGE_LOAD_LOG=str(args.evidence_dir / 'loader.json'))
        loader_path = args.evidence_dir / 'loader.json'
        loader_path.unlink(missing_ok=True)
        version = subprocess.check_output(['psql', '--version'], text=True).strip()
        print(json.dumps({'postgres': version, 'database_commit': pins['database_commit'], 'api_baseline_commit': pins['api_baseline_commit'], 'api_modified_from_baseline': pins['api_modified_from_baseline'], 'source_pins': 'matched', 'environment_keys': sorted(env)}), flush=True)
        result = subprocess.run(['node', str(API / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(HERE / 'vitest.bridge.config.ts')], cwd=API, env=env, timeout=180)
        if result.returncode:
            raise RuntimeError('Bridge qualification failed')
        attribution = json.loads(loader_path.read_text())
        if attribution['missing'] or set(attribution['loaded']) != set(pins['api_files']):
            raise RuntimeError('Incomplete frozen-module load attribution')
    finally:
        fixture.doClassCleanups()  # Lease cleanup never removes cluster files.
        (args.worker / 'worker-cleanup.json').write_text(json.dumps({'errors': [str(e[1]) for e in fixture.tearDown_exceptions]}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--database-repo', type=pathlib.Path)
    parser.add_argument('--pg-bin', type=pathlib.Path)
    parser.add_argument('--evidence-dir', type=pathlib.Path, required=True)
    parser.add_argument('--worker', type=pathlib.Path)
    parser.add_argument('--fault', choices=FAULTS)
    parser.add_argument('--self-test-cleanup', action='store_true')
    parser.add_argument('--fail-before-bootstrap', action='store_true')
    args = parser.parse_args()
    pins = json.loads((HERE / 'sources.json').read_text())
    if args.worker:
        worker(args, pins)
        return
    if not args.database_repo or not args.pg_bin:
        parser.error('--database-repo and --pg-bin required')
    args.evidence_dir = args.evidence_dir.resolve()
    args.evidence_dir.mkdir(parents=True, exist_ok=True)
    if args.self_test_cleanup:
        stale_dir = args.evidence_dir / 'stale-marker'
        stale_dir.mkdir(exist_ok=True)
        (stale_dir / 'fault-reached.json').write_text(json.dumps({'fault': 'partial-bootstrap'}))
        result = subprocess.run([sys.executable, str(HERE / 'run.py'), '--database-repo', str(args.database_repo), '--pg-bin', str(args.pg_bin), '--evidence-dir', str(stale_dir), '--fault', 'partial-bootstrap', '--fail-before-bootstrap'], capture_output=True, text=True)
        (stale_dir / 'expected-failure.log').write_text(result.stdout + result.stderr)
        stale_report = json.loads((stale_dir / 'cleanup.json').read_text())
        if result.returncode == 0 or stale_report['fault_reached'] or not stale_report['files_removed']:
            raise RuntimeError('Stale fault marker falsely qualified early worker failure')
        print(json.dumps({'stale_marker_rejected': True, 'worker_returncode': stale_report['worker_returncode']}), flush=True)
        for fault in FAULTS:
            subprocess.run([sys.executable, str(HERE / 'run.py'), '--database-repo', str(args.database_repo), '--pg-bin', str(args.pg_bin), '--evidence-dir', str(args.evidence_dir / fault), '--fault', fault], check=True)
        return
    verify_api(API, pins)
    sources = {}
    for name, expected in pins['database_files'].items():
        data = subprocess.check_output([shutil.which('git'), '-C', str(args.database_repo), 'show', pins['database_commit'] + ':' + name], env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent', 'LANG': 'C'})
        if hashlib.sha256(data).hexdigest() != expected:
            raise RuntimeError('Database source mismatch: ' + name)
        sources[name] = data
    def interrupted(_signum, _frame):
        raise InterruptedError('Fixture supervisor interrupted')
    signal.signal(signal.SIGTERM, interrupted)
    # No automatic deletion/finalizer: preserve files unless parent proves shutdown.
    root = pathlib.Path(tempfile.mkdtemp(prefix='sites-bridge-', dir=str(pathlib.Path('/tmp').resolve())))
    env = {'PATH': os.pathsep.join([str(args.pg_bin.resolve()), str(pathlib.Path(shutil.which('node')).parent), '/usr/bin', '/bin']),
           'HOME': str(root), 'TMPDIR': str(root), 'LANG': 'en_US.UTF-8' if sys.platform == 'darwin' else 'C.UTF-8',
           'LC_ALL': 'en_US.UTF-8' if sys.platform == 'darwin' else 'C.UTF-8', 'USER': getpass.getuser(), 'LOGNAME': getpass.getuser()}
    child = None
    report = {'root': str(root), 'fault': args.fault, 'timed_out': False, 'files_removed': False}
    try:
        for name, data in sources.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        command = [sys.executable, str(HERE / 'run.py'), '--worker', str(root), '--evidence-dir', str(args.evidence_dir)]
        if args.fault:
            command += ['--fault', args.fault]
        if args.fail_before_bootstrap:
            command += ['--fail-before-bootstrap']
        child = subprocess.Popen(command, env=env, start_new_session=True)
        try:
            child.wait(timeout=4 if args.fault else 240)
        except subprocess.TimeoutExpired:
            report['timed_out'] = True
    finally:
        try:
            if child:
                report.update(quiesce_worker(child))
                report.update(stop_owned_cluster(root, args.pg_bin.resolve(), env, child.pid))
            current_marker = root / 'fault-reached.json'
            marker = json.loads(current_marker.read_text()) if current_marker.exists() else {}
            report['fault_reached'] = bool(child and marker == {'fault': args.fault, 'root': str(root), 'worker_pid': child.pid})
            for name in ('fixture-owner.json', 'fault-reached.json', 'worker-cleanup.json'):
                if (root / name).exists():
                    shutil.copy2(root / name, args.evidence_dir / name)
            for log in root.glob('recoup-cases-*/pg.log'):
                shutil.copy2(log, args.evidence_dir / 'postgres.log')
            shutil.rmtree(root)
            report['files_removed'] = not root.exists()
        except BaseException as error:
            report['cleanup_error'] = str(error)
            report['preserved_root'] = str(root)
            raise
        finally:
            (args.evidence_dir / 'cleanup.json').write_text(json.dumps(report, indent=2) + '\n')
    if args.fault:
        if not report['fault_reached']:
            raise RuntimeError('Requested lifecycle fault was not reached')
        if not all(report.get(k) for k in ('worker_group_absent', 'postmaster_absent', 'socket_absent', 'files_removed')):
            raise RuntimeError('Fault cleanup not proven')
        print(json.dumps({'cleanup_fault_passed': args.fault, **report}), flush=True)
    elif report['timed_out'] or child.returncode:
        raise RuntimeError('Isolated bridge worker failed; owned lifecycle cleaned')


if __name__ == '__main__':
    main()
