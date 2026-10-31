"""API writer vectors against pinned Context SQL; disposable socket-only PostgreSQL.
The dropped acknowledgement is a synthetic transport seam after a real SQL commit.
No hosted service, credentials, migration application, or current-authority lookup.
"""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest

sys.dont_write_bytecode = True

# Reuse the existing git-pinned loader, setup and cleanup, not a copied SQL implementation.
spec = importlib.util.spec_from_file_location("golden", Path(__file__).with_name("test-sql-golden.py"))
golden = importlib.util.module_from_spec(spec)
spec.loader.exec_module(golden)  # consumes the database repository argv
Protocol, quote = golden.Protocol, golden.quote
vectors = json.loads(Path(__file__).with_name("persistence-vectors.json").read_text())
results = []

class Persistence(golden.Golden):
    def test_vectors(self):
        admissions = vectors["admissions"]
        self.chat, self.account = "chat", vectors["account"]
        Protocol.sql(f"INSERT INTO sessions(id,account_id,title) VALUES('session',{quote(self.account)},'synthetic'); INSERT INTO chats(id,session_id,title) VALUES('chat','session','synthetic'); INSERT INTO chat_messages(id,chat_id,role,parts) VALUES('historical','chat','assistant',{quote(json.dumps(vectors['historical']))}::jsonb);")
        Protocol.sql(f"SELECT public.enable_chat_fence('chat',{quote(self.account)})")
        def admit(index):
            p = admissions[index]
            receipt = self.cmd("admit", p)
            token = {"epoch":receipt["epoch"],"owner":p["request_id"],"run_id":f"original-run-{index}"}
            attempt = "77777777-7777-4777-8777-777777777777"
            self.assertTrue(self.cmd("claim_dispatch", {"epoch":token["epoch"],"owner":token["owner"],"attempt_id":attempt})["claimed"])
            self.cmd("bind", {**token,"attempt_id":attempt})
            return token
        def check(name, receipt=None, code=None, drop=False):
            command = vectors["commands"][name]
            sql = f"SELECT public.chat_fence_command('chat',{quote(self.account)},{quote(command['action'])},{quote(json.dumps(command['payload']))}::jsonb);"
            run = subprocess.run(Protocol.args()+["-U","service_role","-v","VERBOSITY=verbose"],input=sql,text=True,capture_output=True,timeout=15)
            entry = {"name":name,"command":command}
            if code:
                self.assertNotEqual(run.returncode,0)
                self.assertRegex(run.stderr,rf"ERROR:\s+{code}:")
                entry["code"] = code
            else:
                self.assertEqual(run.returncode,0,run.stderr)
                actual = json.loads(run.stdout)
                self.assertEqual(actual,receipt)
                entry["receipt"] = actual
            if drop: entry["dropAcknowledgement"] = True
            results.append(entry)
            print(f"PASS {name}: {code or receipt}" + (" (discarded acknowledgement)" if drop else ""),flush=True)
        inserted = {"written":True,"outcome":"inserted"}
        replay = {"written":True,"outcome":"exactDuplicate"}
        token = admit(0)
        check("user",inserted)
        check("user",replay)
        check("changedUser",code="22023")
        check("assistant",inserted)
        check("assistant",replay)
        check("assistantChanged",{"written":True,"outcome":"updated"})
        check("assistantChanged",replay)
        check("parts",{"updated":True})
        self.assertEqual(json.loads(Protocol.sql("SELECT parts FROM chat_messages WHERE id='assistant-1'")),vectors["commands"]["parts"]["payload"]["parts"])
        self.assertEqual(json.loads(Protocol.sql("SELECT parts FROM chat_messages WHERE id='user-1'")),vectors["commands"]["user"]["payload"]["parts"])
        check("missing",{"updated":False})
        check("ambiguous",inserted,drop=True)
        # Explicit same-command replay, not an adapter retry or replacement authority.
        check("ambiguous",replay)
        self.cmd("release",{**token,"reason":"workflow_complete"})
        token = admit(1)
        check("user",code="40001")
        check("assistant",code="40001")
        check("parts",code="40001")
        check("previousAssistant",code="40001")
        check("previousParts",code="40001")
        check("historicalAssistant",code="40001")
        check("historicalParts",code="40001")
        # Pinned SQL expressly permits identical user replay across generations.
        check("crossGenerationUserReplay",replay)
        self.cmd("release",{**token,"reason":"workflow_complete"})
        deleted = self.cmd("delete",{"expected_epoch":2,"request_id":"88888888-8888-4888-8888-888888888888","anchor_id":"user-1"})
        self.assertEqual(deleted["epoch"],3)
        token = admit(2)
        check("deletedUser",code="40001")
        check("deletedAssistant",code="40001")
        self.assertEqual(self.cmd("state",{})["epoch"],4)
        # Full UIMessage remained in historical row; destructive edit removed only its suffix.
        self.assertEqual(json.loads(Protocol.sql("SELECT parts FROM chat_messages WHERE id='historical'")),vectors["historical"])

if __name__ == "__main__":
    print(f"Pinned Context SQL/harness: {golden.COMMIT}; API writer vectors; synthetic transport loss",flush=True)
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Persistence))
    if result.wasSuccessful() and os.environ.get("CHAT_FENCE_PERSISTENCE_SQL_RESULT"):
        Path(os.environ["CHAT_FENCE_PERSISTENCE_SQL_RESULT"]).write_text(json.dumps(results,indent=2)+"\n")
    sys.exit(not result.wasSuccessful())
