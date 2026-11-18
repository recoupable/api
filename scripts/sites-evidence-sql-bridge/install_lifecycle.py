"""Instrument only fixture directory/process lifecycle; leave SQL bytes intact."""
import json
import os
import pathlib
import signal
import subprocess
import tempfile
import time
from types import SimpleNamespace


def _register_lease(root, prefix):
    """No deleting finalizer: only the supervising parent may remove this directory."""
    socket = pathlib.Path(tempfile.mkdtemp(prefix=prefix, dir=root)).resolve()
    info = socket.stat()
    metadata = {'socket': str(socket), 'cluster': str(socket / 'pg'),
                'uid': info.st_uid, 'device': info.st_dev, 'inode': info.st_ino,
                'worker_pid': os.getpid()}
    pending = root / 'fixture-owner.pending'
    pending.write_text(json.dumps(metadata))
    pending.replace(root / 'fixture-owner.json')
    return SimpleNamespace(name=str(socket), cleanup=lambda: None)


def install_lifecycle(module, root, fault):
    """Instrument process/directory lifecycle only; leave bootstrap and SQL bytes intact."""
    module.harness.tempfile.TemporaryDirectory = lambda prefix: _register_lease(root, prefix)
    fixture = module.SitesEvidence
    original_sql = fixture.sql
    first = True

    def sql(cls, statement):
        nonlocal first
        if first:
            first = False
            metadata = json.loads((root / 'fixture-owner.json').read_text())
            metadata['postmaster_pid'] = int((pathlib.Path(metadata['cluster']) / 'postmaster.pid').read_text().splitlines()[0])
            (root / 'fixture-owner.json').write_text(json.dumps(metadata))
            if fault in ('partial-bootstrap', 'blocked-sql', 'missing-pid'):
                (root / 'fault-reached.json').write_text(json.dumps({'fault': fault, 'root': str(root), 'worker_pid': os.getpid()}))
            if fault == 'missing-pid':
                # Deterministically reproduce detached-live-postmaster/no-file state.
                metadata.pop('postmaster_pid')
                (root / 'fixture-owner.json').write_text(json.dumps(metadata))
                (pathlib.Path(metadata['cluster']) / 'postmaster.pid').unlink()
                (pathlib.Path(metadata['socket']) / '.s.PGSQL.55473').unlink()
                os._exit(74)
            if fault == 'partial-bootstrap':
                os._exit(73)
            if fault == 'blocked-sql':
                signal.signal(signal.SIGTERM, signal.SIG_IGN)
                return original_sql('SELECT pg_sleep(60);')
        return original_sql(statement)
    fixture.sql = classmethod(sql)
    original_run = subprocess.run

    def run(command, **kwargs):
        is_start = command[0] == 'pg_ctl' and command[-1] == 'start'
        is_stop = command[0] == 'pg_ctl' and command[-1] == 'stop'
        if (fault == 'startup' and is_start) or (fault == 'shutdown-timeout' and is_stop):
            # Keep the actual control subprocess lifecycle open across parent timeout.
            # It inherits the dedicated worker process group.
            (root / 'fault-reached.json').write_text(json.dumps({'fault': fault, 'root': str(root), 'worker_pid': os.getpid()}))
            subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
            time.sleep(60)
        if fault == 'shutdown-error' and is_stop:
            (root / 'fault-reached.json').write_text(json.dumps({'fault': fault, 'root': str(root), 'worker_pid': os.getpid()}))
            raise RuntimeError('Synthetic worker shutdown failure')
        return original_run(command, **kwargs)
    subprocess.run = run

    def interrupted(_signum, _frame):
        raise InterruptedError('Parent requested fixture worker termination')
    signal.signal(signal.SIGTERM, interrupted)
    return fixture
