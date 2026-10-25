"""API vectors on Context's pinned disposable PG harness; no SQL copied or changed.
Usage: python3 scripts/chat-fence-fixture/test-sql-golden.py /path/to/database
"""
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import types
import unittest
COMMIT = "1d19c6c7c026520c3e8d028c51d4f674972fd8f0"
REPO = Path(sys.argv.pop(1)).resolve()
PROPOSAL = "proposals/chat-writer-fencing-636"

def source(path):
    return subprocess.run(["git", "-C", str(REPO), "show", f"{COMMIT}:{path}"], check=True, capture_output=True, text=True).stdout

class GitSource:
    def __init__(self, path): self.path = path
    def __truediv__(self, name): return GitSource(f"{self.path}/{name}" if self.path else name)
    def read_text(self): return source(self.path)

context = types.ModuleType("pinned_context_protocol")
context.__file__ = str(REPO / PROPOSAL / "test_protocol.py")
exec(compile(source(f"{PROPOSAL}/test_protocol.py"), context.__file__, "exec"), context.__dict__)
context.HERE, context.ROOT = GitSource(PROPOSAL), GitSource("")
Protocol, quote = context.Protocol, context.quote
roundtrips = []
vectors = json.loads(Path(__file__).with_name("golden-vectors.json").read_text())

class Golden(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Context owns setup, socket-only listener and teardown, including setup-failure cleanup.
        cls.addClassCleanup(Protocol.doClassCleanups)
        try:
            Protocol.setUpClass()
        except subprocess.CalledProcessError as error:
            print(error.stderr, file=sys.stderr)
            raise
    def prepare(self, vector):
        p = copy.deepcopy(vector["payload"])
        a = p["admission_envelope"]
        self.chat, self.account = a["chatId"], a["effectiveAccountId"]
        Protocol.sql(f"INSERT INTO sessions(id,account_id,title) VALUES({quote(a['sessionId'])},{quote(self.account)},'synthetic'); INSERT INTO chats(id,session_id,title) VALUES({quote(self.chat)},{quote(a['sessionId'])},'synthetic');")
        Protocol.sql(f"SELECT public.enable_chat_fence({quote(self.chat)},{quote(self.account)})")
        return p
    def cmd(self, action, payload):
        return json.loads(Protocol.sql(f"SET ROLE service_role; SELECT public.chat_fence_command({quote(self.chat)},{quote(self.account)},{quote(action)},{quote(json.dumps(payload))}::jsonb);"))
    def test_vectors(self):
        for vector in vectors:
            with self.subTest(vector=vector["name"]):
                p = self.prepare(vector)
                receipt = self.cmd("admit", p)
                result = self.cmd("admission_snapshot", {"request_id": p["request_id"]})
                self.assertEqual(result, {"receipt": receipt, **{k: p[k] for k in ("admission_envelope", "execution_snapshot", "admission_canonical", "execution_canonical")}})
                self.assertEqual(hashlib.sha256(result["admission_canonical"].encode()).hexdigest(), p["input_hash"])
                self.assertEqual(hashlib.sha256(result["execution_canonical"].encode()).hexdigest(), p["admission_envelope"]["executionSnapshot"]["digest"])
                roundtrips.append({"name": vector["name"], "stored": result})
                self.assertEqual(self.cmd("admit", p), receipt)
                for key in ("admission_canonical", "execution_canonical"):
                    altered = copy.deepcopy(p); altered[key] += " "
                    with self.assertRaises(AssertionError): self.cmd("admit", altered)
                for key in ("admission_envelope", "execution_snapshot"):
                    altered = copy.deepcopy(p); altered[key]["chatId"] = "foreign-chat"
                    with self.assertRaises(AssertionError): self.cmd("admit", altered)
                # Rehash a consistent foreign execution scope to exercise SQL scope checks,
                # rather than merely relying on the projection/hash mismatch check above.
                altered = copy.deepcopy(p)
                altered["execution_snapshot"]["sessionId"] = "foreign-session"
                altered["execution_canonical"] = p["execution_canonical"].replace(p["execution_snapshot"]["sessionId"], "foreign-session")
                original_digest = p["admission_envelope"]["executionSnapshot"]["digest"]
                foreign_digest = hashlib.sha256(altered["execution_canonical"].encode()).hexdigest()
                altered["admission_envelope"]["executionSnapshot"]["digest"] = foreign_digest
                altered["admission_canonical"] = p["admission_canonical"].replace(original_digest, foreign_digest)
                altered["input_hash"] = hashlib.sha256(altered["admission_canonical"].encode()).hexdigest()
                with self.assertRaises(AssertionError): self.cmd("admit", altered)
                altered = copy.deepcopy(p); altered["input_hash"] = "a" * 64
                with self.assertRaises(AssertionError): self.cmd("admit", altered)
                for invalid in ("\x00", "\ud800", "\udfff"):
                    altered = copy.deepcopy(p); altered["admission_envelope"][invalid] = invalid
                    with self.assertRaises(AssertionError): self.cmd("admit", altered)
                with self.assertRaises(AssertionError): self.cmd("admission_snapshot", {"request_id": "66666666-6666-4666-8666-666666666666"})
                self.cmd("release", {"epoch": 1, "owner": p["request_id"], "reason": "confirmed_no_start"})
                newer = copy.deepcopy(p)
                newer["request_id"] = "55555555-5555-4555-8555-555555555555"
                newer["expected_epoch"] = 1
                newer["admission_envelope"]["expectedEpoch"] = 1
                newer["execution_snapshot"]["requestId"] = newer["request_id"]
                # Scalar substitutions in API bytes, never Python canonicalization.
                newer["execution_canonical"] = p["execution_canonical"].replace(p["request_id"], newer["request_id"])
                old_digest = p["admission_envelope"]["executionSnapshot"]["digest"]
                new_digest = hashlib.sha256(newer["execution_canonical"].encode()).hexdigest()
                newer["admission_envelope"]["executionSnapshot"]["digest"] = new_digest
                newer["admission_canonical"] = p["admission_canonical"].replace('"expectedEpoch":0', '"expectedEpoch":1').replace(old_digest, new_digest)
                newer["input_hash"] = hashlib.sha256(newer["admission_canonical"].encode()).hexdigest()
                self.cmd("admit", newer)
                old = self.cmd("admission_snapshot", {"request_id": p["request_id"]})
                roundtrips.append({"name": vector["name"] + "-closed", "stored": old})
                self.assertTrue(old["receipt"]["closed"])
                self.assertEqual(old["receipt"]["epoch"], 1)
                self.assertEqual(old["execution_canonical"], p["execution_canonical"])
                self.assertEqual(self.cmd("state", {})["owner"], newer["request_id"])
                print(f"PASS {vector['name']}: roundtrip, tampering, invalid chars, closed original/new owner", flush=True)

if __name__ == "__main__":
    print(f"Pinned Context SQL/harness: {COMMIT}; synthetic API vectors only", flush=True)
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Golden))
    if result.wasSuccessful() and os.environ.get("CHAT_FENCE_SQL_OUTPUT"):
        Path(os.environ["CHAT_FENCE_SQL_OUTPUT"]).write_text(json.dumps(roundtrips, ensure_ascii=False, indent=2) + "\n")
    sys.exit(not result.wasSuccessful())
