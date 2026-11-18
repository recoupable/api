"""Quiesce only the dedicated fixture worker process group."""
import os
import signal
import subprocess
import time


def _group_exists(group):
    try:
        os.killpg(group, 0)
        return True
    except ProcessLookupError:
        return False


def quiesce_worker(worker):
    """Signal only the session/group created for this exact Popen child."""
    group = worker.pid  # start_new_session=True establishes PID == PGID == SID.
    if _group_exists(group):
        os.killpg(group, signal.SIGTERM)
        try:
            worker.wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass
    if _group_exists(group):
        os.killpg(group, signal.SIGKILL)
    worker.wait(timeout=5)
    deadline = time.monotonic() + 5
    while _group_exists(group) and time.monotonic() < deadline:
        time.sleep(0.05)
    if _group_exists(group):
        raise RuntimeError('Fixture process group not quiescent; preserve owned files')
    return {'worker_pid': worker.pid, 'worker_group_absent': True, 'worker_returncode': worker.returncode}
