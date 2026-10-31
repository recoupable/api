"""API delete traces against pinned existing SQL; socket-only disposable PostgreSQL.
Usage: CHAT_FENCE_DELETE_SQL_RESULT=/tmp/results.json python3 ... /path/to/database
Only new adapter vectors run; the unchanged Context proposal suite is not rerun.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import types
import unittest

sys.dont_write_bytecode = True
COMMIT = "7914f063729db04960149647d9ee19c8f857c417"
REPO = Path(sys.argv.pop(1)).resolve()
PROPOSAL = "proposals/chat-writer-fencing-636"

def source(path):
    return subprocess.check_output(["git", "-C", str(REPO), "show", f"{COMMIT}:{path}"], text=True)

class GitSource:
    def __init__(self, path): self.path = path
    def __truediv__(self, name): return GitSource(f"{self.path}/{name}" if self.path else name)
    def read_text(self): return source(self.path)

context = types.ModuleType("pinned_context_delete")
context.__file__ = str(REPO / PROPOSAL / "test_protocol.py")
exec(compile(source(f"{PROPOSAL}/test_protocol.py"), context.__file__, "exec"), context.__dict__)
context.HERE, context.ROOT = GitSource(PROPOSAL), GitSource("")
Protocol, quote = context.Protocol, context.quote
vectors = json.loads(Path(__file__).with_name("vectors.json").read_text())
results = []

class DeleteVectors(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.addClassCleanup(Protocol.doClassCleanups)
        Protocol.setUpClass()

    def cmd(self, action, payload):
        return json.loads(Protocol.sql(f"SET ROLE service_role; SELECT public.chat_fence_command('chat',{quote(vectors['account'])},{quote(action)},{quote(json.dumps(payload))}::jsonb)"))

    def check(self, name, code=None, rollback=False, drop=False):
        args = vectors['commands'][name]
        sql = f"SELECT public.chat_fence_command({quote(args['p_chat'])},{quote(args['p_account'])},{quote(args['p_action'])},{quote(json.dumps(args['p']))}::jsonb);"
        if rollback: sql = 'BEGIN; ' + sql + ' ROLLBACK;'
        run = subprocess.run(Protocol.args()+['-U','service_role','-v','VERBOSITY=verbose'], input=sql,text=True,capture_output=True,timeout=15)
        entry = {'name':name,'args':args}
        if code:
            self.assertNotEqual(run.returncode,0);self.assertRegex(run.stderr,rf'ERROR:\s+{code}:');entry['code']=code
        else:
            self.assertEqual(run.returncode,0,run.stderr)
            receipt=json.loads(run.stdout)
            self.assertEqual(receipt,{'request_id':args['p']['request_id'],'epoch':2,'deleted':3})
            entry['receipt']=receipt
        if rollback:entry['rolledBack']=True
        if drop:entry['dropAcknowledgement']=True
        results.append(entry)
        print(f"PASS {name}: {code or entry['receipt']} rollback={rollback} dropAck={drop}",flush=True)

    def test_adapter_vectors(self):
        account=vectors['account']
        Protocol.sql(f"INSERT INTO sessions(id,account_id,title) VALUES('session',{quote(account)},'synthetic'),('foreign-session',{quote(account)},'synthetic'); INSERT INTO chats(id,session_id,title) VALUES('chat','session','synthetic'),('foreign-chat','foreign-session','synthetic');")
        rows=[('a','2026-10-25T12:00:00.123456Z'),('b','2026-10-25T12:00:00.123456Z'),('c','2026-10-25T12:00:00.123456Z'),('d','2026-10-25T12:00:00.123455Z'),('e','2026-10-25T12:00:00.123457Z')]
        for id,ts in rows:
            message={'id':id,'role':'user','parts':[]}
            Protocol.sql(f"INSERT INTO chat_messages(id,chat_id,role,parts,created_at) VALUES({quote(id)},'chat','user',{quote(json.dumps(message))}::jsonb,{quote(ts)})")
        Protocol.sql("INSERT INTO chat_messages(id,chat_id,role,parts) VALUES('foreign-message','foreign-chat','user','{}')")
        Protocol.sql(f"SELECT enable_chat_fence('chat',{quote(account)})")
        first=vectors['admissions'][0];self.cmd('admit',first)
        self.check('active',code='40001') # pending refusal
        token={'owner':first['request_id'],'epoch':1,'run_id':'first-run'}
        attempt='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        self.cmd('claim_dispatch',{**token,'attempt_id':attempt});self.cmd('bind',{**token,'attempt_id':attempt})
        self.check('active',code='40001') # running refusal
        self.cmd('release',{**token,'reason':'workflow_complete'})
        self.check('stale',code='40001');self.check('foreignAnchor',code='P0002');self.check('wrongAccount',code='42501')
        self.check('rollback',rollback=True)
        self.assertEqual(self.cmd('state',{})['epoch'],1)
        self.assertEqual(Protocol.sql("SELECT count(*) FROM chat_messages WHERE chat_id='chat'"),'5')
        self.check('delete',drop=True) # Real commit; drop acknowledgement only in transport fixture.
        self.assertEqual(Protocol.sql("SELECT string_agg(id,',' ORDER BY id) FROM chat_messages WHERE chat_id='chat'"),'a,d')
        self.check('delete') # duplicate receipt, no mutation
        self.check('changed',code='22023') # same key/different anchor, even if deleted
        second=vectors['admissions'][1];self.cmd('admit',second)
        self.check('delete') # original receipt wins over newer pending state
        new={'owner':second['request_id'],'epoch':3,'run_id':'new-run'}
        self.cmd('claim_dispatch',{**new,'attempt_id':attempt});self.cmd('bind',{**new,'attempt_id':attempt})
        self.cmd('write',{**new,'id':'new-message','role':'assistant','mode':'upsert','parts':{'id':'new-message','role':'assistant','parts':[]}})
        self.check('delete') # no deletion of newer running owner's messages
        self.check('changed',code='22023')
        self.assertEqual(self.cmd('state',{})['run_id'],'new-run')
        self.assertEqual(Protocol.sql("SELECT count(*) FROM chat_messages WHERE id='new-message'"),'1')
        with self.assertRaisesRegex(AssertionError,'deleted identity'):
            self.cmd('write',{**new,'id':'b','role':'user','mode':'insert','parts':{'id':'b','role':'user','parts':[]}})
        self.assertEqual(Protocol.sql("SELECT chat_id FROM chat_messages WHERE id='foreign-message'"),'foreign-chat')
        print('PASS tied timestamp inclusive suffix, transaction rollback, original receipt after newer owner, tombstone reuse and cross-chat preservation',flush=True)

if __name__=='__main__':
    print(f'Pinned existing SQL/harness {COMMIT}; API-generated delete traces; no provider calls',flush=True)
    result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(DeleteVectors))
    if result.wasSuccessful() and os.environ.get('CHAT_FENCE_DELETE_SQL_RESULT'):
        Path(os.environ['CHAT_FENCE_DELETE_SQL_RESULT']).write_text(json.dumps({'sqlCommit':COMMIT,'results':results},indent=2)+'\n')
    sys.exit(not result.wasSuccessful())
