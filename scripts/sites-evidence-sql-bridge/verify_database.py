"""Verify pinned materialized Database bytes."""
import hashlib


def verify_database(root, pins):
    for name, expected in pins['database_files'].items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError('Materialized Database source mismatch: ' + name)
