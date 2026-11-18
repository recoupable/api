"""Parent-owned lifecycle for a single registered disposable PostgreSQL fixture."""
import json
import os
import pathlib
import shlex
import signal
import subprocess
import tempfile
import time
from types import SimpleNamespace


def register_lease(root, prefix):
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
    module.harness.tempfile.TemporaryDirectory = lambda prefix: register_lease(root, prefix)
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


def group_exists(group):
    try:
        os.killpg(group, 0)
        return True
    except ProcessLookupError:
        return False


def quiesce_worker(worker):
    """Signal only the session/group created for this exact Popen child."""
    group = worker.pid  # start_new_session=True establishes PID == PGID == SID.
    if group_exists(group):
        os.killpg(group, signal.SIGTERM)
        try:
            worker.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass
    if group_exists(group):
        os.killpg(group, signal.SIGKILL)
    worker.wait(timeout=5)
    deadline = time.monotonic() + 5
    while group_exists(group) and time.monotonic() < deadline:
        time.sleep(0.05)
    if group_exists(group):
        raise RuntimeError('Fixture process group not quiescent; preserve owned files')
    return {'worker_pid': worker.pid, 'worker_group_absent': True, 'worker_returncode': worker.returncode}


def process_command(pid):
    result = subprocess.run(['/bin/ps', '-ww', '-p', str(pid), '-o', 'command='], capture_output=True, text=True, timeout=5)
    if result.returncode == 1 and not result.stdout.strip():
        return None
    if result.returncode:
        raise RuntimeError('Cannot verify fixture process identity')
    return result.stdout.strip() or None


def owned_postmasters(cluster):
    # Read process metadata locally; expose only PIDs exactly bound to this lease.
    result = subprocess.run(['/bin/ps', '-ww', '-axo', 'pid=,command='], capture_output=True, text=True, timeout=5)
    if result.returncode:
        raise RuntimeError('Cannot enumerate owned startup processes; preserve root')
    found = []
    for line in result.stdout.splitlines():
        fields = line.strip().split(None, 1)
        if len(fields) != 2 or str(cluster) not in fields[1]:
            continue
        try:
            argv = shlex.split(fields[1])
        except ValueError:
            raise RuntimeError('Ambiguous owned startup process; preserve root')
        if not argv or pathlib.Path(argv[0]).name != 'postgres' or '-D' not in argv or argv[argv.index('-D') + 1] != str(cluster):
            raise RuntimeError('Unquiesced process references owned cluster; preserve root')
        found.append(int(fields[0]))
    return found


def stop_owned_cluster(root, pg_bin, env, worker_pid):
    metadata_path = root / 'fixture-owner.json'
    if not metadata_path.exists():
        if list(root.glob('recoup-cases-*')):
            raise RuntimeError('Unregistered fixture directory; preserve root')
        return {'cluster_created': False, 'socket_absent': True, 'postmaster_absent': True}
    metadata = json.loads(metadata_path.read_text())
    socket = pathlib.Path(metadata['socket'])
    cluster = pathlib.Path(metadata['cluster'])
    if socket.parent != root or socket.resolve() != socket or socket.is_symlink() or cluster != socket / 'pg' or cluster.is_symlink():
        raise RuntimeError('Fixture path ownership mismatch; preserve root')
    info = socket.stat()
    if (info.st_uid, info.st_dev, info.st_ino) != (metadata['uid'], metadata['device'], metadata['inode']) or info.st_uid != os.getuid() or metadata['worker_pid'] != worker_pid:
        raise RuntimeError('Fixture directory identity mismatch; preserve root')
    pidfile = cluster / 'postmaster.pid'
    discovered = owned_postmasters(cluster)
    if len(discovered) > 1:
        raise RuntimeError('Multiple postmasters bound to lease; preserve root')
    pid = metadata.get('postmaster_pid')
    if pidfile.exists():
        lines = pidfile.read_text().splitlines()
        pid = int(lines[0])
        if pathlib.Path(lines[1]).resolve() != cluster:
            raise RuntimeError('Postmaster data directory mismatch; preserve root')
        if discovered and discovered != [pid]:
            raise RuntimeError('Postmaster PID identity mismatch; preserve root')
        if discovered:
            result = subprocess.run([str(pg_bin / 'pg_ctl'), '-D', str(cluster), '-m', 'immediate', '-w', '-t', '5', 'stop'], env=env, capture_output=True, text=True, timeout=8)
            if result.returncode:
                raise RuntimeError('Parent could not stop owned PostgreSQL: ' + result.stderr)
    elif discovered:
        # A detached postmaster can precede its PID/socket files. Independently
        # bind its command to the exact owned -D path before targeted immediate stop.
        pid = discovered[0]
        if owned_postmasters(cluster) != [pid]:
            raise RuntimeError('Startup process identity changed; preserve root')
        os.kill(pid, signal.SIGQUIT)
    deadline = time.monotonic() + 8
    while owned_postmasters(cluster) and time.monotonic() < deadline:
        time.sleep(0.05)
    if owned_postmasters(cluster) or (pid and process_command(pid)):
        raise RuntimeError('Recorded postmaster still present; preserve root')
    socket_file = socket / '.s.PGSQL.55473'
    if socket_file.exists():
        raise RuntimeError('Owned PostgreSQL socket still present; preserve root')
    return {'cluster_created': True, 'registered_socket': str(socket), 'registered_cluster': str(cluster),
            'postmaster_pid': pid, 'discovered_postmasters': discovered,
            'postmaster_absent': True, 'socket_absent': True}
