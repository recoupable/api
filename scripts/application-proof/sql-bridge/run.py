"""Pinned API -> SQL qualification using only a fresh Unix-socket PostgreSQL fixture."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import tempfile
import os

HERE = pathlib.Path(__file__).resolve().parent
API = HERE.parents[2]


def run(args, **kwargs):
    result = subprocess.run(args, text=True, capture_output=True, **kwargs)
    if result.returncode:
        raise RuntimeError(result.stdout + result.stderr)
    return result.stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--database-repo', required=True, type=pathlib.Path)
    args = parser.parse_args()
    pins = json.loads((HERE / 'sources.json').read_text())
    for name, expected in pins['api_files'].items():
        if hashlib.sha256((API / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError('API source pin mismatch: ' + name)
    sources = {}
    for name, expected in pins['database_files'].items():
        source = subprocess.check_output(['git', '-C', str(args.database_repo), 'show', pins['database_commit'] + ':' + name])
        if hashlib.sha256(source).hexdigest() != expected:
            raise RuntimeError('Database source pin mismatch: ' + name)
        sources[pathlib.Path(name).name] = source.decode()
    with tempfile.TemporaryDirectory(prefix='recoup-proof-bridge-') as directory:
        root = pathlib.Path(directory)
        cluster = root / 'pg'
        run(['initdb', '-D', str(cluster), '-A', 'trust'])
        started = False
        try:
            run(['pg_ctl', '-D', str(cluster), '-l', str(root / 'postgres.log'), '-o',
                 f"-k {directory} -p 55483 -c listen_addresses=''", '-w', 'start'])
            started = True
            sql_args = ['psql', '-h', directory, '-p', '55483', '-d', 'postgres', '-XqAt', '-v', 'ON_ERROR_STOP=1']
            for name in ['fixture.sql', 'proposal.sql', 'configuration-fixture.sql', 'configuration.sql']:
                run(sql_args, input=sources[name])
            proposal = sources['proposal.sql']
            (root / 'default-authority.sql').write_text(proposal[proposal.index('-- DEFAULT AUTHORITY'):proposal.index('-- TRANSACTION')])
            (root / 'fixture-authority.sql').write_text(sources['fixture-authority.sql'])
            (root / 'offline-fixture.json').write_text(json.dumps({'offline_only': True, 'database_commit': pins['database_commit']}))
            env = {**os.environ, 'RECOUP_PROOF_BRIDGE_SOCKET': directory}
            print(json.dumps({'api_commit':pins['api_commit'],'database_commit':pins['database_commit'],
                              'source_pins':'matched','postgres':run(['psql','--version']).strip()}), flush=True)
            result = subprocess.run(['pnpm','exec','vitest','run','--config',str(HERE / 'vitest.bridge.config.ts')],
                                    cwd=API, env=env, timeout=120)
            if result.returncode:
                raise RuntimeError('Bridge qualification failed')
        finally:
            if started:
                run(['pg_ctl','-D',str(cluster),'-m','immediate','-w','stop'])


if __name__ == '__main__':
    main()
