"""Verify exact API bytes, baseline attribution and materialized Database bytes."""
import hashlib
import subprocess


def verify_api(api, pins):
    changed = []
    for name, expected in pins['api_files'].items():
        data = (api / name).read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise RuntimeError('API source mismatch: ' + name)
        baseline = subprocess.check_output(['git', '-C', str(api), 'show', pins['api_baseline_commit'] + ':' + name],
                                           env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent', 'LANG': 'C'})
        if data != baseline:
            changed.append(name)
    if set(changed) != set(pins['api_modified_from_baseline']):
        raise RuntimeError('API baseline modification allowlist mismatch')


def verify_database(root, pins):
    for name, expected in pins['database_files'].items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError('Materialized Database source mismatch: ' + name)
