"""Verify and stop PostgreSQL bound to one registered directory lease."""
import json
import os
import pathlib
import shlex
import signal
import subprocess
import time


def _process_command(pid):
    result = subprocess.run(['/bin/ps', '-ww', '-p', str(pid), '-o', 'command='], capture_output=True, text=True, timeout=5)
    if result.returncode == 1 and not result.stdout.strip():
        return None
    if result.returncode:
        raise RuntimeError('Cannot verify fixture process identity')
    return result.stdout.strip() or None


def _owned_postmasters(cluster):
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
    discovered = _owned_postmasters(cluster)
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
        if _owned_postmasters(cluster) != [pid]:
            raise RuntimeError('Startup process identity changed; preserve root')
        os.kill(pid, signal.SIGQUIT)
    deadline = time.monotonic() + 8
    while _owned_postmasters(cluster) and time.monotonic() < deadline:
        time.sleep(0.05)
    if _owned_postmasters(cluster) or (pid and _process_command(pid)):
        raise RuntimeError('Recorded postmaster still present; preserve root')
    socket_file = socket / '.s.PGSQL.55473'
    if socket_file.exists():
        raise RuntimeError('Owned PostgreSQL socket still present; preserve root')
    return {'cluster_created': True, 'registered_socket': str(socket), 'registered_cluster': str(cluster),
            'postmaster_pid': pid, 'discovered_postmasters': discovered,
            'postmaster_absent': True, 'socket_absent': True}
