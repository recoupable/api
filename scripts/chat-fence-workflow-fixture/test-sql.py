"""Replay actual compiled workflow commands on disposable pinned SQL (no hosted calls).
Usage: python3 scripts/chat-fence-workflow-fixture/test-sql.py DATABASE COMPILED_RESULTS
"""
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest
sys.dont_write_bytecode = True
spec=importlib.util.spec_from_file_location("golden",Path(__file__).parents[1]/"chat-fence-fixture/test-sql-golden.py")
golden=importlib.util.module_from_spec(spec)
spec.loader.exec_module(golden)
artifact=json.loads(Path(sys.argv.pop(1)).read_text())
Protocol,quote=golden.Protocol,golden.quote
receipts=[]
class CompiledCommands(golden.Golden):
    def test_vectors(self):
        self.assertEqual(artifact["result"],"PASS")
        p=self.prepare({"payload":artifact["admissionPayload"]})
        self.cmd("admit",p)
        trace=next(t for t in artifact["traces"] if t["name"]=="success")
        commands=[e["data"] for e in trace["trace"] if e["action"]=="rpc"]
        binding=commands[0]["p"]
        claim=self.cmd("claim_dispatch",{k:binding[k] for k in ("epoch","owner","attempt_id")})
        self.assertTrue(claim["claimed"])
        expected=[{"bound":True},{"written":True,"outcome":"inserted"},{"written":True,"outcome":"inserted"},{"written":True,"outcome":"updated"},{"updated":True},{"released":True}]
        self.assertEqual(len(commands),len(expected))
        for command,want in zip(commands,expected):
            self.assertEqual(command["p_chat"],self.chat)
            self.assertEqual(command["p_account"],self.account)
            self.assertEqual(command["p"]["run_id"],trace["runId"])
            actual=self.cmd(command["p_action"],command["p"])
            self.assertEqual(actual,want)
            receipts.append({"command":command,"receipt":actual})
            if command["p_action"]=="bind":
                # A different actual workflow run cannot bind or clean up the winner.
                loser={**command["p"],"run_id":"losing-duplicate-run"}
                with self.assertRaisesRegex(AssertionError,"bound|stale|conflict"):
                    self.cmd("bind",loser)
                self.assertEqual(self.cmd("state",{})["run_id"],trace["runId"])
            if command["p_action"]=="update_parts":
                stored=json.loads(Protocol.sql(f"SELECT parts FROM chat_messages WHERE id={quote(command['p']['id'])}"))
                self.assertEqual(stored,command["p"]["parts"])
                self.assertTrue(any(part["type"]=="data-commit" for part in stored["parts"]))
                self.assertEqual(stored["metadata"]["trace"],"retained")
        self.assertEqual(self.cmd("state",{})["phase"],"idle")
        for command in commands[1:-1]:
            with self.assertRaisesRegex(AssertionError,"stale|bound|running"):
                self.cmd(command["p_action"],command["p"])
        # Released original authority cannot mutate/release a new generation.
        p2=golden.copy.deepcopy(p)
        p2["request_id"]="55555555-5555-4555-8555-555555555555"
        p2["expected_epoch"]=1;p2["admission_envelope"]["expectedEpoch"]=1
        p2["execution_snapshot"]["requestId"]=p2["request_id"]
        p2["execution_canonical"]=p["execution_canonical"].replace(p["request_id"],p2["request_id"])
        digest=golden.hashlib.sha256(p2["execution_canonical"].encode()).hexdigest()
        p2["admission_envelope"]["executionSnapshot"]["digest"]=digest
        p2["admission_canonical"]=p["admission_canonical"].replace('"expectedEpoch":0','"expectedEpoch":1').replace(p["admission_envelope"]["executionSnapshot"]["digest"],digest)
        p2["input_hash"]=golden.hashlib.sha256(p2["admission_canonical"].encode()).hexdigest()
        self.cmd("admit",p2)
        old_release=self.cmd("release",commands[-1]["p"])
        self.assertEqual(old_release,{"released":False})
        self.assertEqual(self.cmd("state",{})["owner"],p2["request_id"])
        print("PASS compiled production commands: bind/user/routing/assistant/update_parts/release, full readback, duplicate loser, stale writes and newer-owner release isolation",flush=True)
if __name__=="__main__":
    print(f"Pinned SQL/harness {golden.COMMIT}; replayed compiled command trace, separate from synthetic workflow run",flush=True)
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(CompiledCommands))
    if result.wasSuccessful() and os.environ.get("WORKFLOW_FENCE_SQL_OUTPUT"):
        Path(os.environ["WORKFLOW_FENCE_SQL_OUTPUT"]).write_text(json.dumps(receipts,indent=2)+"\n")
    sys.exit(not result.wasSuccessful())
