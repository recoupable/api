"""Narrow paired test using pinned owning DB bootstrap and reviewed lifecycle helper."""
import argparse
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
from types import SimpleNamespace

HERE = pathlib.Path(__file__).resolve().parent
API = HERE.parents[1]

def read(repo, ref, path, expected):
    data = subprocess.check_output(['git', '-C', str(repo), 'show', ref + ':' + path], env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent', 'LANG': 'C'})
    if hashlib.sha256(data).hexdigest() != expected:
        raise RuntimeError('Pinned source mismatch: ' + path)
    return data

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--database-repo', type=pathlib.Path, required=True)
    parser.add_argument('--lifecycle-repo', type=pathlib.Path, default=API)
    parser.add_argument('--pg-bin', type=pathlib.Path, required=True)
    parser.add_argument('--evidence-dir', type=pathlib.Path, required=True)
    args = parser.parse_args()
    pins = json.loads((HERE / 'sources.json').read_text())
    evidence = args.evidence_dir.resolve(); evidence.mkdir(parents=True, exist_ok=True)
    # The accepted composition is a Git tree, not an applied migration or deploy commit.
    tree = subprocess.check_output(['git', '-C', str(args.database_repo), 'merge-tree', '--write-tree', pins['database_head'], pins['database_base']], text=True).strip()
    if tree != pins['database_tree']:
        raise RuntimeError('Unexpected Database composition')
    sources = {name: read(args.database_repo, tree, name, digest) for name, digest in pins['database_files'].items()}
    lifecycle = read(args.lifecycle_repo, pins['lifecycle_commit'], pins['lifecycle_path'], pins['lifecycle_sha256'])
    node = shutil.which('node'); pg = args.pg_bin.resolve()
    root = pathlib.Path(tempfile.mkdtemp(prefix='catalog-size-', dir='/tmp')).resolve()
    fixture = None; child = None; report = {'root': str(root), 'files_removed': False}
    env = {'PATH': str(pg) + ':' + str(pathlib.Path(node).parent) + ':/usr/bin:/bin', 'HOME': str(root), 'TMPDIR': str(root), 'LANG': 'en_US.UTF-8' if sys.platform == 'darwin' else 'C.UTF-8', 'LC_ALL': 'en_US.UTF-8' if sys.platform == 'darwin' else 'C.UTF-8'}
    os.environ.clear(); os.environ.update(env)
    try:
        for name, data in sources.items():
            target = root / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
        helper = root / 'lifecycle.py'; helper.write_bytes(lifecycle)
        spec = importlib.util.spec_from_file_location('catalog_fixture_lifecycle', helper)
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        sys.path.insert(0, str(root / 'tests'))
        import catalog_size_fixture
        fixture = module.install_lifecycle(SimpleNamespace(harness=catalog_size_fixture.base, SitesEvidence=catalog_size_fixture.CatalogSizeFixture), root, None)
        fixture.setUpClass()
        run_env = dict(env, SITES_BRIDGE_SOCKET=fixture.tmp.name, CATALOG_PSQL=str(pg / 'psql'), CATALOG_RESULT=str(evidence / 'result.json'), SITES_BRIDGE_LOAD_LOG=str(evidence / 'loader.json'))
        child = subprocess.Popen([node, str(API / 'node_modules/vitest/vitest.mjs'), 'run', '--config', str(HERE / 'vitest.config.ts')], cwd=API, env=run_env, start_new_session=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        output, _ = child.communicate(timeout=90)
        (evidence / 'tests.log').write_text(output)
        report['test_exit'] = child.returncode
    finally:
        try:
            if child:
                module.quiesce_worker(child)
            if fixture:
                fixture.doClassCleanups()
            if 'module' in locals():
                report.update(module.stop_owned_cluster(root, pg, env, os.getpid()))
            elif list(root.glob('recoup-cases-*')):
                raise RuntimeError('Unverified fixture; retain root')
            shutil.rmtree(root); report['files_removed'] = True
        except BaseException as error:
            report['cleanup_error'] = str(error)
            raise
        finally:
            (evidence / 'cleanup.json').write_text(json.dumps(report, indent=2))
    if report['test_exit']:
        raise RuntimeError('Paired size qualification failed; see tests.log')

if __name__ == '__main__':
    main()
