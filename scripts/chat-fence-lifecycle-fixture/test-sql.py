"""Actual adapter command traces replayed on exact disposable Context SQL.
Usage: python3 scripts/chat-fence-lifecycle-fixture/test-sql.py DATABASE TRACE_JSON
SDK cancellation/status evidence in TRACE_JSON is synthetic; no providers are contacted.
"""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location("golden",Path(__file__).parents[1]/"chat-fence-fixture/test-sql-golden.py")
golden=importlib.util.module_from_spec(spec);spec.loader.exec_module(golden)
artifact=json.loads(Path(sys.argv.pop(1)).read_text())
Protocol=golden.Protocol
results=[]
class Lifecycle(golden.Golden):
    def newer(self,p):
        # Preserve API canonical bytes except explicit scalar changes; no Python canonicalization.
        q=copy.deepcopy(p);q["request_id"]="55555555-5555-4555-8555-555555555555"
        q["expected_epoch"]=1;q["admission_envelope"]["expectedEpoch"]=1
        q["execution_snapshot"]["requestId"]=q["request_id"]
        q["execution_canonical"]=p["execution_canonical"].replace(p["request_id"],q["request_id"])
        digest=hashlib.sha256(q["execution_canonical"].encode()).hexdigest()
        q["admission_envelope"]["executionSnapshot"]["digest"]=digest
        q["admission_canonical"]=p["admission_canonical"].replace('"expectedEpoch":0','"expectedEpoch":1').replace(p["admission_envelope"]["executionSnapshot"]["digest"],digest)
        q["input_hash"]=hashlib.sha256(q["admission_canonical"].encode()).hexdigest()
        self.cmd("admit",q)
        token={"epoch":2,"owner":q["request_id"],"run_id":"newer-run"}
        attempt="88888888-8888-4888-8888-888888888888"
        self.cmd("claim_dispatch",{"epoch":2,"owner":token["owner"],"attempt_id":attempt})
        self.cmd("bind",{**token,"attempt_id":attempt})
        return token
    def test_vectors(self):
        for trace in artifact["traces"]:
            with self.subTest(name=trace["name"]):
                p=self.prepare({"payload":trace["admission"]});self.cmd("admit",p)
                target=trace["target"];name=trace["name"]
                original={"epoch":1,"owner":target["owner"],"run_id":target["runId"]}
                attempt="77777777-7777-4777-8777-777777777777"
                if name.startswith("pending"):
                    observed=self.cmd("admission_snapshot",{"request_id":target["owner"]})
                    self.assertEqual(observed["dispatch"],{"status":"never_attempted","attempt_id":None})
                    self.cmd("claim_dispatch",{"epoch":1,"owner":target["owner"],"attempt_id":attempt})
                    self.assertEqual(trace["commands"],[]);self.assertEqual(trace["sdk"],[]);self.assertEqual(trace["httpStatus"],503)
                    self.assertEqual(self.cmd("state",{})["phase"],"pending")
                    self.assertEqual(self.cmd("admission_snapshot",{"request_id":target["owner"]})["dispatch"]["status"],"claimed")
                    if name=="pending-stop":
                        # CONTROL ONLY: SQL61d8 accepts this despite the intervening claim.
                        # Adapter never issues it. This demonstrates why observation is not no-start proof.
                        control=self.cmd("release",{"epoch":1,"owner":target["owner"],"reason":"confirmed_no_start"})
                        self.assertEqual(control,{"released":True})
                        results.append({"name":name,"adapterCommands":0,"adapterStatus":503,"unsafeControlReleaseAfterClaim":control})
                    else:
                        self.cmd("bind",{"epoch":1,"owner":target["owner"],"run_id":"delayed-original-run","attempt_id":attempt})
                        self.assertEqual(self.cmd("state",{})["run_id"],"delayed-original-run")
                        results.append({"name":name,"adapterCommands":0,"adapterStatus":503,"lateBindPreserved":True})
                    continue
                self.cmd("claim_dispatch",{"epoch":1,"owner":target["owner"],"attempt_id":attempt})
                self.cmd("bind",{**original,"attempt_id":attempt})
                if name in ("closed-original","stale-original"):
                    self.cmd("release",{**original,"reason":"external_terminal"})
                    if name=="stale-original":self.newer(p)
                receipts=[]
                for item in trace["commands"]:
                    args=item["args"]
                    self.assertEqual(args["p_chat"],self.chat);self.assertEqual(args["p_account"],self.account)
                    if name=="release-race" and args["p_action"]=="release":
                        self.cmd("release",{**original,"reason":"external_terminal"});self.newer(p)
                    actual=self.cmd(args["p_action"],args["p"])
                    self.assertEqual(actual,item["receipt"])
                    if args["p_action"]=="release":self.assertEqual(args["p"],{**original,"reason":"external_terminal"})
                    receipts.append({"command":args,"receipt":actual})
                state=self.cmd("state",{})
                if name in ("stale-original","release-race"):self.assertEqual(state["run_id"],"newer-run")
                elif name in ("stop-success","resume-terminal","closed-original"):self.assertEqual(state["phase"],"idle")
                else:self.assertEqual(state["run_id"],original["run_id"])
                results.append({"name":name,"httpStatus":trace["httpStatus"],"receipts":receipts,"finalState":state})
                print(f"PASS {name}: actual adapter commands, captured original scope, expected SQL receipts/state",flush=True)
if __name__=="__main__":
    print(f"Pinned SQL/harness {golden.COMMIT}; pending race control is disposable only, never an adapter command",flush=True)
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Lifecycle))
    if result.wasSuccessful() and os.environ.get("CHAT_LIFECYCLE_SQL_OUTPUT"):
        Path(os.environ["CHAT_LIFECYCLE_SQL_OUTPUT"]).write_text(json.dumps(results,indent=2)+"\n")
    sys.exit(not result.wasSuccessful())
