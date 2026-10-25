"""Actual adapter command traces replayed on exact disposable Context SQL.
Usage: python3 scripts/chat-fence-lifecycle-fixture/test-sql.py DATABASE TRACE_JSON
SDK cancellation/status evidence in TRACE_JSON is synthetic; no providers are contacted.
"""
import concurrent.futures
import subprocess
import time
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
    def race(self,first,second):
        action,payload=first
        command=f"SET ROLE service_role; SELECT public.chat_fence_command({golden.quote(self.chat)},{golden.quote(self.account)},{golden.quote(action)},{golden.quote(json.dumps(payload))}::jsonb);"
        process=subprocess.Popen(Protocol.args(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
        try:
            process.stdin.write('BEGIN; '+command+" SELECT 'LOCKED';\n");process.stdin.flush()
            first_result=json.loads(process.stdout.readline())
            self.assertEqual(process.stdout.readline().strip(),'LOCKED')
            with concurrent.futures.ThreadPoolExecutor(1) as ex:
                future=ex.submit(self.cmd,*second)
                try:
                    deadline=time.monotonic()+4
                    while int(Protocol.sql(f"SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%{self.chat}%' AND pid<>pg_backend_pid()"))<1:
                        if time.monotonic()>deadline:self.fail('second command never reached a real database lock')
                        time.sleep(.02)
                    self.assertFalse(future.done())
                finally:
                    process.stdin.write('COMMIT;\n');process.stdin.flush()
                return first_result,future.result(timeout=5)
        finally:
            process.stdin.close();process.wait(timeout=5);process.stdout.close();process.stderr.close()
    def test_vectors(self):
        for trace in artifact["traces"]:
            with self.subTest(name=trace["name"]):
                p=self.prepare({"payload":trace["admission"]});self.cmd("admit",p)
                target=trace["target"];name=trace["name"]
                original={"epoch":1,"owner":target["owner"],"run_id":target["runId"]}
                attempt="77777777-7777-4777-8777-777777777777"
                if name.startswith("pending"):
                    token={"epoch":1,"owner":target["owner"]}
                    before=self.cmd("admission_snapshot",{"request_id":target["owner"]})
                    self.assertEqual(before["dispatch"],{"status":"never_attempted","attempt_id":None})
                    # The unattempted generic release is now rejected. No provider proof is inferred.
                    with self.assertRaisesRegex(AssertionError,"release proof"):
                        self.cmd("release",{**token,"reason":"confirmed_no_start"})
                    self.assertEqual(trace["sdk"],[])
                    claim={**token,"attempt_id":attempt}
                    receipts=[]
                    if name=="pending-resume":
                        self.cmd("claim_dispatch",claim)
                        self.assertEqual(trace["commands"],[])
                        self.cmd("bind",{**token,"run_id":"delayed-original-run","attempt_id":attempt})
                        self.assertEqual(self.cmd("state",{})["run_id"],"delayed-original-run")
                    else:
                        self.assertEqual(len(trace["commands"]),1)
                        item=trace["commands"][0];args=item["args"]
                        self.assertEqual(args,{"p_chat":self.chat,"p_account":self.account,"p_action":"close_unattempted","p":token})
                        if name in ("pending-close-wins","pending-claim-wins"):
                            # First real command holds its locks while the competing command blocks.
                            close_first=name=="pending-close-wins"
                            first=("close_unattempted",args["p"]) if close_first else ("claim_dispatch",claim)
                            second=("claim_dispatch",claim) if close_first else ("close_unattempted",args["p"])
                            first_result,second_result=self.race(first,second)
                            actual=first_result if close_first else second_result
                            claim_result=second_result if close_first else first_result
                            self.assertEqual(claim_result["claimed"],not close_first)
                            self.assertEqual(claim_result["receipt"]["closed"],close_first)
                            if close_first:self.assertIsNone(claim_result["attempt_id"])
                            else:
                                # Claim remains bindable; close false never grants release/cancel.
                                self.cmd("bind",{**token,"run_id":"delayed-original-run","attempt_id":attempt})
                        else:
                            if name=="pending-bound":
                                self.cmd("claim_dispatch",claim)
                                self.cmd("bind",{**token,"run_id":"bound-original-run","attempt_id":attempt})
                            if name in ("pending-stale","pending-retry"):
                                self.assertEqual(self.cmd("close_unattempted",token),{"closed":True})
                                if name=="pending-stale":self.newer(p)
                            actual=self.cmd(args["p_action"],args["p"])
                        self.assertEqual(actual,item["receipt"])
                        receipts.append({"command":args,"receipt":actual})
                    after=self.cmd("admission_snapshot",{"request_id":target["owner"]})
                    for field in ("admission_envelope","execution_snapshot","admission_canonical","execution_canonical"):
                        self.assertEqual(before[field],after[field])
                    state=self.cmd("state",{})
                    self.assertEqual(state["epoch"],2 if name=="pending-stale" else 1)
                    self.assertEqual(Protocol.sql(f"SELECT count(*) FROM chat_messages WHERE chat_id={golden.quote(self.chat)}"),"0")
                    if name=="pending-stale":self.assertEqual(state["run_id"],"newer-run")
                    elif name in ("pending-close-wins","pending-retry","pending-lost-ack"):
                        self.assertTrue(after["receipt"]["closed"]);self.assertEqual(state["phase"],"idle")
                    else:
                        self.assertFalse(after["receipt"]["closed"]);self.assertEqual(state["phase"],"running")
                    self.assertEqual(trace["httpStatus"],200 if name=="pending-close-wins" else 503)
                    results.append({"name":name,"httpStatus":trace["httpStatus"],"receipts":receipts,"finalState":state,"immutableSnapshotPreserved":True,"realLockRace":name in ("pending-close-wins","pending-claim-wins"),"lostAcknowledgement":name=="pending-lost-ack"})
                    print(f"PASS {name}: exact atomic close, original authority, no fallback effects",flush=True)
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
    print(f"Pinned SQL/harness {golden.COMMIT}; two-connection atomic close races use actual adapter command bytes",flush=True)
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Lifecycle))
    if result.wasSuccessful() and os.environ.get("CHAT_LIFECYCLE_SQL_OUTPUT"):
        Path(os.environ["CHAT_LIFECYCLE_SQL_OUTPUT"]).write_text(json.dumps(results,indent=2)+"\n")
    sys.exit(not result.wasSuccessful())
