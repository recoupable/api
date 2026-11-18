"""Explicit local paired-proposal test. No hosted credentials or TCP listener."""
import argparse
import os
import pathlib
import subprocess
import sys
parser=argparse.ArgumentParser()
parser.add_argument('--database',required=True,type=pathlib.Path)
args=parser.parse_args()
proposal=args.database.resolve()/'proposals/pack-worker-fence-2269'
assert all((proposal/name).is_file() for name in ['test_contract.py','schema.sql','command.sql','receipts.sql'])
sys.path.insert(0,str(proposal))
from test_contract import FencedPacks
root=pathlib.Path(__file__).resolve().parents[2]
try:
    FencedPacks.setUpClass()
    env={**os.environ,'PACK_FENCE_TEST_SOCKET':FencedPacks.tmp.name,'PACK_FENCE_TEST_PORT':'55476'}
    result=subprocess.run(['pnpm','exec','vitest','run','lib/content/packs/fence/__tests__/packFencePostgres.test.ts'],cwd=root,env=env)
    raise SystemExit(result.returncode)
finally:
    FencedPacks.doClassCleanups()
