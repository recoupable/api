"""Compose Node qualification with the exact reviewed Database lease supervisor."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import time
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
API = HERE.parents[2]


def database_module(database):
    """Validate the pinned fixture sources before importing their lifecycle owner."""
    bindings = json.loads((HERE / 'source-bindings.json').read_text())
    for relative, expected in bindings['databaseInputs'].items():
        if hashlib.sha256((database / relative).read_bytes()).hexdigest() != expected:
            raise RuntimeError('Database source binding mismatch: ' + relative)
    source = database / 'proposals/application-registration-2104/test_registration.py'
    spec = importlib.util.spec_from_file_location('registration_lifecycle', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run_worker(database, node, fault=None):
    """Use the validated existing lease, load exact SQL and run only composition tests."""
    module = database_module(Path(database))
    socket, pg_bin = module.prepare_worker_environment()
    module.Registration.setUpClass()
    root = Path(socket).parent
    scope = {'socket': socket, 'driver_pid': os.getpid(), 'supervisor_pid': os.getppid(),
             'postmaster_pid': int((Path(socket)/'pg/postmaster.pid').read_text().splitlines()[0])}
    descriptor = root / 'composition-scope.json'
    descriptor.write_text(json.dumps(scope))
    descriptor.chmod(0o600)
    env = {**module.fixture_environment(root, pg_bin),
           'PRIVY_PROJECT_SECRET': 'synthetic-registration-secret', 'PRIVY_APP_ID': 'synthetic-app',
           'NODE_ENV': 'test'}
    command = [node, '--import', str(HERE/'socket-guard.mjs'),
               str((API/'node_modules/vitest/vitest.mjs').resolve(strict=True)), 'run', '--config', str(HERE/'vitest.config.ts')]
    # No new session: Node/Vitest descendants remain in the reviewed worker's owned group.
    if fault:
        # A real preloaded Node descendant announces readiness before controlled failure.
        marker = root / 'fault-node-ready'
        code = "import {writeFileSync} from 'node:fs';writeFileSync(" + json.dumps(str(marker)) + ",String(process.pid));setInterval(()=>{},1000)"
        command = [node, '--import', str(HERE/'socket-guard.mjs'), '--input-type=module', '-e', code]
        child = subprocess.Popen(command, cwd=API, env=env)
        deadline = time.monotonic() + 10
        while not marker.exists():
            if child.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError('Fault descendant failed to initialize')
            time.sleep(.02)
        if int(marker.read_text()) != child.pid:
            raise RuntimeError('Fault descendant identity mismatch')
        print('COMPOSITION_FAULT_READY ' + json.dumps({'fault': fault, 'node_pid': child.pid, 'driver_pid': os.getpid(), 'supervisor_pid': os.getppid()}), flush=True)
        if fault == 'signal':
            os.kill(os.getppid(), signal.SIGTERM)
            child.wait(timeout=10)
        elif fault == 'worker-exit':
            raise SystemExit(23)
        else:
            child.wait(timeout=.3)
        raise RuntimeError('Fault unexpectedly returned')
    result = subprocess.run(command, cwd=API, env=env, timeout=90)
    raise SystemExit(result.returncode)


def main():
    """Delegate lifecycle/cleanup unchanged; preserve trampoline on ambiguous failure."""
    parser = argparse.ArgumentParser()
    parser.add_argument('--database-root', required=True)
    parser.add_argument('--node', required=True)
    parser.add_argument('--fault', choices=['signal', 'timeout', 'worker-exit'])
    args = parser.parse_args()
    database = Path(args.database_root).resolve(strict=True)
    node = str(Path(args.node).resolve(strict=True))
    pg_bin = str(Path(os.environ['PG_BIN']).resolve(strict=True))
    # Scrub again before loading fixture code; never forward an ambient credential variable.
    clean = {key: os.environ[key] for key in ['HOME', 'TMPDIR', 'PATH', 'LANG', 'LC_ALL', 'TZ']}
    os.environ.clear()
    os.environ.update({**clean, 'PG_BIN': pg_bin})
    module = database_module(database)
    trampoline_root = Path(tempfile.mkdtemp(prefix='composition-driver-')).resolve()
    trampoline = trampoline_root / 'worker.py'
    trampoline.write_text(
        "import importlib.util\n"
        + "spec=importlib.util.spec_from_file_location('composition_driver'," + repr(str(Path(__file__).resolve())) + ")\n"
        + "driver=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(driver)\n"
        + "driver.run_worker(" + repr(str(database)) + "," + repr(node) + "," + repr(args.fault) + ")\n")
    # HERE stays bound to exact Database sources; only the supervised worker entry is changed.
    module.__file__ = str(trampoline)
    try:
        result = module.supervise()
    except BaseException:
        print('PRESERVED_COMPOSITION_DRIVER ' + str(trampoline_root), file=sys.stderr, flush=True)
        raise
    else:
        # supervise returns only after lease-bound worker/cluster cleanup succeeds.
        shutil.rmtree(trampoline_root)
        raise SystemExit(result)


if __name__ == '__main__':
    main()
