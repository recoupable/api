"""Captured edit preparation against exact disposable SQL7914; no hosted calls.
Usage: python3 scripts/chat-fence-edit/test-sql.py DATABASE [COMPILED_RESULTS]
"""
import importlib.util,json,os,sys,unittest
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location("golden",Path(__file__).parents[1]/"chat-fence-fixture/test-sql-golden.py")
golden=importlib.util.module_from_spec(spec);spec.loader.exec_module(golden)
Protocol,quote=golden.Protocol,golden.quote
vectors=json.loads(Path(__file__).with_name("vectors.json").read_text())
compiled=json.loads(Path(sys.argv.pop(1)).read_text()) if len(sys.argv)>1 else None
results=[]
class EditedTurn(golden.Golden):
 def test_vectors(self):
  for vector in vectors:
   with self.subTest(name=vector['name']):
    p=self.prepare({'payload':vector['initial']});self.cmd('admit',p)
    token={'epoch':1,'owner':p['request_id'],'run_id':'original-'+vector['name']};attempt='77777777-7777-4777-8777-777777777777'
    self.cmd('claim_dispatch',{'epoch':1,'owner':token['owner'],'attempt_id':attempt});self.cmd('bind',{**token,'attempt_id':attempt})
    for message in p['admission_envelope']['messages']:
     self.cmd('write',{**token,'id':message['id'],'role':message['role'],'mode':'insert' if message['role']=='user' else 'upsert','parts':message})
    self.cmd('release',{**token,'reason':'workflow_complete'})
    if vector['name']=='unseen-collision':
     other=self.chat+'-historical';session=other+'-session';replacement=vector['prepared']['admission']['payload']['admission_envelope']['messages'][-1]
     Protocol.sql(f"INSERT INTO sessions(id,account_id,title) VALUES({quote(session)},{quote(self.account)},'synthetic'); INSERT INTO chats(id,session_id,title) VALUES({quote(other)},{quote(session)},'synthetic'); INSERT INTO chat_messages(id,chat_id,role,parts) VALUES({quote(replacement['id'])},{quote(other)},'user',{quote(json.dumps(replacement))}::jsonb);")
     Protocol.sql(f"SELECT public.enable_chat_fence({quote(other)},{quote(self.account)})")
     saved=self.chat;self.chat=other
     self.cmd('delete',{'request_id':'99999999-9999-4999-8999-999999999999','expected_epoch':0,'anchor_id':replacement['id']});self.chat=saved
    command=vector['commands'][0]
    self.assertEqual(command['p_chat'],self.chat);self.assertEqual(command['p_account'],self.account);self.assertEqual(command['p_action'],'delete')
    receipt=self.cmd('delete',command['p']);self.assertEqual(receipt,vector['deleteReceipt'])
    after=json.loads(Protocol.sql(f"SELECT coalesce(jsonb_agg(parts ORDER BY created_at,id),'[]'::jsonb) FROM chat_messages WHERE chat_id={quote(self.chat)}"))
    self.assertEqual(after,p['admission_envelope']['messages'][:2])
    admission=vector['prepared']['admission'];nextp=admission['payload'];self.assertEqual(nextp['expected_epoch'],receipt['epoch'])
    row={'name':vector['name'],'deleteReceipt':receipt,'admission':admission}
    if vector['name']=='lost-ack':
     # Transport harness discards receipt; no admission or start follows. Optional TS roundtrip uses a rejection.
     self.assertEqual(self.cmd('state',{})['phase'],'idle');self.assertEqual(self.cmd('state',{})['epoch'],2)
     row['admissionIssued']=False
    elif vector['name']=='newer-owner':
     # Same request identity with changed bytes is rejected by existing immutable SQL guard.
     # Another owner wins epoch2 first, so this originally captured proposal remains stale.
     competing=json.loads(json.dumps(nextp));competing['request_id']='88888888-8888-4888-8888-888888888888'
     old=nextp['request_id'];competing['execution_snapshot']['requestId']=competing['request_id'];competing['execution_canonical']=competing['execution_canonical'].replace(old,competing['request_id'])
     import hashlib
     digest=hashlib.sha256(competing['execution_canonical'].encode()).hexdigest();previous=competing['admission_envelope']['executionSnapshot']['digest']
     competing['admission_envelope']['executionSnapshot']['digest']=digest;competing['admission_canonical']=competing['admission_canonical'].replace(previous,digest);competing['input_hash']=hashlib.sha256(competing['admission_canonical'].encode()).hexdigest()
     self.cmd('admit',competing)
     self.assertEqual(self.cmd('delete',command['p']),receipt)
     with self.assertRaisesRegex(AssertionError,'admission conflict'):self.cmd('admit',nextp)
     self.assertEqual(self.cmd('state',{})['owner'],competing['request_id']);row['newerOwnerPreserved']=True
    else:
     admitted=self.cmd('admit',nextp);self.assertEqual(admitted['epoch'],3)
     self.assertEqual(self.cmd('admit',nextp),admitted)
     with self.assertRaisesRegex(AssertionError,'retry input conflict'):self.cmd('admit',vector['changed']['admission']['payload'])
     row['changedInputRejected']=True
     writer={'epoch':3,'owner':nextp['request_id'],'run_id':'edited-'+vector['name']}
     self.cmd('claim_dispatch',{'epoch':3,'owner':writer['owner'],'attempt_id':attempt})
     if vector['name']=='success' and compiled:
      trace=next(t for t in compiled['traces'] if t['name']=='edited-turn')
      commands=[e['data'] for e in trace['trace'] if e['action']=='rpc']
      self.assertEqual(commands[0]['p_action'],'bind');writer['run_id']=commands[0]['p']['run_id']
      row['compiledReceipts']=[]
      for c in commands:
       self.assertEqual(c['p_chat'],self.chat);self.assertEqual(c['p_account'],self.account)
       self.assertEqual(c['p']['epoch'],3);self.assertEqual(c['p']['owner'],writer['owner'])
       actual=self.cmd(c['p_action'],c['p'])
       expected={'bind':{'bound':True},'write':{'written':True,'outcome':'inserted'},'release':{'released':True}}[c['p_action']]
       self.assertEqual(actual,expected)
       row['compiledReceipts'].append({'command':c,'receipt':actual})
       if c['p_action']=='bind':
        oldmessage=p['admission_envelope']['messages'][2]
        with self.assertRaisesRegex(AssertionError,'deleted identity'):self.cmd('write',{**writer,'id':oldmessage['id'],'role':'user','mode':'insert','parts':oldmessage})
        row['oldUserRejected']=True
      state=self.cmd('state',{})
      self.assertEqual(state,{'chat_id':self.chat,'epoch':3,'phase':'idle','owner':None,'run_id':None})
      row['compiledReplay']=True;row['finalState']=state
     else:
      self.cmd('bind',{**writer,'attempt_id':attempt})
      oldmessage=p['admission_envelope']['messages'][2]
      with self.assertRaisesRegex(AssertionError,'deleted identity'):self.cmd('write',{**writer,'id':oldmessage['id'],'role':'user','mode':'insert','parts':oldmessage})
      row['oldUserRejected']=True
      replacement=nextp['admission_envelope']['messages'][-1]
      if vector['name']=='unseen-collision':
       with self.assertRaisesRegex(AssertionError,'deleted identity'):self.cmd('write',{**writer,'id':replacement['id'],'role':'user','mode':'insert','parts':replacement})
       row['unseenTombstoneRejected']=True
      else:self.cmd('write',{**writer,'id':replacement['id'],'role':'user','mode':'insert','parts':replacement})
     if vector['name']=='success':
      # Tombstone survives replacement and completion; rejection above used current bound authority.
      self.assertEqual(Protocol.sql(f"SELECT count(*) FROM chat_fence.tombstones WHERE message_id={quote(command['p']['anchor_id'])}"),'1')
      replacement=nextp['admission_envelope']['messages'][-1]
      stored=json.loads(Protocol.sql(f"SELECT parts FROM chat_messages WHERE id={quote(replacement['id'])} AND chat_id={quote(self.chat)}"))
      self.assertEqual(stored,replacement)
      row['freshUserAccepted']=True;row['replacementReadback']=stored
    results.append(row);print('PASS '+vector['name'],flush=True)
if __name__=='__main__':
 print('Pinned SQL '+golden.COMMIT,flush=True)
 result=unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(EditedTurn))
 if result.wasSuccessful() and os.environ.get('EDITED_TURN_SQL_RESULTS'):Path(os.environ['EDITED_TURN_SQL_RESULTS']).write_text(json.dumps(results,indent=2)+'\n')
 sys.exit(not result.wasSuccessful())
