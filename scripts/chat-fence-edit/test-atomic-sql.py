"""Run actual API adapters against pinned Context SQL on disposable socket-only PG15/17.
Usage: PG_BIN=/path/to/bin python3 scripts/chat-fence-edit/test-atomic-sql.py DATABASE [--admission-only]
Optional focused admission qualification remains offline: no dispatch, claims, providers or workflows.
No remote DSN or production migration.
"""
import os
from pathlib import Path
import subprocess
import sys
import types

COMMIT = "aeb346cc53bf8c45031fe56b7bf64659329161b2"
REPO = Path(sys.argv[1]).resolve()
if sys.argv[2:] not in ([], ["--admission-only"]):
    raise SystemExit("Only --admission-only is supported")
FILTER = ["-t", "explicit saved-original admission"] if sys.argv[2:] else []
PROPOSAL = "proposals/chat-writer-fencing-636"

def source(path):
    return subprocess.check_output(["git", "-C", str(REPO), "show", f"{COMMIT}:{path}"], text=True)

class GitSource:
    def __init__(self, path): self.path = path
    def __truediv__(self, name): return GitSource(f"{self.path}/{name}" if self.path else name)
    def read_text(self): return source(self.path)

context = types.ModuleType("atomic_edit_pinned_protocol")
context.__file__ = str(REPO / PROPOSAL / "test_protocol.py")
exec(compile(source(f"{PROPOSAL}/test_protocol.py"), context.__file__, "exec"), context.__dict__)
context.HERE, context.ROOT = GitSource(PROPOSAL), GitSource("")
Protocol = context.Protocol
print("Pinned SQL " + COMMIT, flush=True)
try:
    Protocol.setUpClass()
    env = dict(os.environ, CHAT_EDIT_SQL_SOCKET=str(Protocol.sock), CHAT_EDIT_SQL_PSQL=str(context.BIN / "psql"), CHAT_EDIT_SQL_PIN=COMMIT)
    result = subprocess.run(["pnpm", "exec", "vitest", "run", "lib/chat/fence/edit/__tests__/atomicEditSqlIntegration.test.ts"] + FILTER, env=env)
    sys.exit(result.returncode)
except subprocess.CalledProcessError as error:
    print(error.stderr, file=sys.stderr)
    raise
finally:
    Protocol.doClassCleanups()
