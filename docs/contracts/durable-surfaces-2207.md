# #2207 API contract proposal: acknowledged working surfaces

Status: source/design proposal, October 27, 2026. Not a route, MCP registration, client schema change, migration or activation. Root adopts the exact contract before UI/API edits. App design [#2373](https://github.com/recoupable/app/pull/2373) at `4d2fee41cdebcac8bcb878fd366702b5c5347cfe`; this API baseline `4ed1fdb1c4d1da38c0e179530205102f64d252c3`. Database proposal is `proposals/durable-surfaces-2207/{PROTOCOL.md,proposal.sql,test_mechanics.py}` in `recoupable/database`; its exact published PR/head is recorded in the handoff.

## Selected storage and existing integration

Recommend a current companion row plus digest-bound operation receipts within the existing **disabled** `chat_fence` schema, keyed to the chat/assistant anchor. This is an extension of the existing chat persistence boundary, not a generic Context store or a separate service. Source snapshot remains in `chat_messages.parts`; controls never live inside a blob overwritten by assistant streaming. Do not reuse `save_brief`: `lib/context/processContextOperation.ts` compiles that snapshot from authorized requests/documents for a purpose.

Current `persistAssistantMessage` awaits `upsertChatMessage(update:true)` but catches errors and returns void. `persistAssistantDataPart` replaces a merged full message and only logs failure. Neither is a Save acknowledgement. Fenced replacements in `app/lib/workflows/fence/README.md` preserve original generation and required write outcomes, but have no public producer/enrollment. This proposal does not wire them.

Existing GET `/api/sessions/{sessionId}/chats/{chatId}` uses `validateGetSessionChatRequest` to authenticate, check exact session ownership and chat/session binding, then `getSessionChatHandler` returns full stored messages. It does not project the new companion or independently reauthorize all embedded workspace/source content. A later enrolled working-surface read must perform both checks and withhold unavailable source data, including text/export/model projections. Do not claim the current raw history route alone implements withdrawal handling.

## Domain API, before any transport exposure

Proposed internal function family under `lib/intelligent-ui/working-surfaces/`: validate bounded input → derive authenticated account → validate session/chat anchor → server-validate source/recipe binding → call the existing Supabase-only boundary → validate normalized receipt → current-scope projection. One shared domain operation serves eventual HTTP/MCP/native/text adapters; no client may call SQL or supply owner credentials. Names here are a contract, not unused executable exports in this PR.

The proposed SQL function is `chat_fence.working_surface_command(chat, account, action, payload)`. It has **no service EXECUTE grant** and its fixed source-authority adapter always denies. A future PostgREST-compatible public-schema wrapper or an approved private-schema RPC exposure is a separate reviewed integration choice; do not assume existing `.rpc()` exposes `chat_fence`. Prefer a small service-only public wrapper once adopted, keeping private relations and implementation private. Do not enable a new schema API merely to make this fixture callable.

Payload contracts (strict JSON, no unexpected keys):

| Operation | Payload | Outcome |
| --- | --- | --- |
| create | message_id, request_id UUID, expected_revision=0, workspace_id UUID, surface_id, surface_revision, server-built authority_binding, work | Revision 1 at existing assistant anchor; absent-version precondition. |
| save | message_id, request_id UUID, expected_revision, work | Atomic N→N+1 only; mismatch is conflict. |
| delete | message_id, request_id UUID, expected_revision | Clears working payload, marks deleted, increments once; keeps minimal identity/receipt. Does not erase original conversation or execute an external action. |
| head | message_id | Current authorized working tuple for reload/second device without local revision knowledge. Never implicitly used to resolve an exact follow-up. |
| read | message_id, revision | Exact current revision only. Superseded revision conflicts; there is no old-controls history store. |
| reconcile | request_id UUID | Original small receipt after authorization; missing is not permission to re-key/replay. |

`work` has exactly `{recipe,displayName,filters,selection}` in the SQL mechanics proof. The future API must validate a named, versioned registered recipe's exact fields; arbitrary filter objects are not an accepted client schema. The prototype uses only synthetic fixture data and has no production recipe registration. `selection` reuses App's existing exact ObjectRefs and eight-item bound, including same workspace, authority, kind, id and complete sourceVersionIds. Confirmed Context UUIDs must come from an authorized join. Catalog/ISRC/run hashes cannot be converted into Context IDs. Unsupported artifact or plan-edit fields reject until an owning contract exists. No arbitrary path patch, HTML, executable expression, URL callback, secret, actor override or implicit effect belongs in work.

API must deep-parse full schema-v1/source snapshot and require one exact data part in the authorized assistant anchor. SQL preserves the entire existing snapshot part with a DB-local digest, but checks only envelope/bounds. Authorize every source and selected ref via the owning adapter; a client-supplied authority_binding is never forwarded as proof. Build it from the saved source and owning rows, and verify it again inside the transaction. Reject duplicates, unsupported recipes, mismatched source/working revisions, malformed UTF-8/JSON values, excessive depth and unsafe integers before RPC. Never truncate or downgrade a forged reference.

Qualification bounds: 128 KiB normalized command, 64 KiB controls, 256 KiB snapshot part, eight selections, 160-character nonempty displayName. SQL measures JSONB text; API also measures outbound UTF-8 before sending. These are offline limits awaiting contract adoption, not current public product promises. ID bounds and field schemas must stay consistent with App schema-v1; generated assistant IDs are fresh and server-owned. Recipe/selection strictness is not proven by the SQL's shape checks.

## Concurrency, receipts and current authority

SQL lock order: session SHARE → chat UPDATE → enabled fence state UPDATE → companion UPDATE → message UPDATE on create → current workspace membership/source locks. Auth is checked again on exact retries and reconciliation. New mutations require idle enabled fence state; no surface operation enrolls a chat. All existing full- message writers, backfill and deletion must follow the accepted 636 boundary; legacy paths remain unchanged for unenrolled chats, where this command refuses.

Source authority is operation-specific. Create/save/head/read and reconciliation of non-delete receipts require current source access; reconciliation of a stored deletion receipt uses delete authority, selected by the stored outcome rather than caller input; delete requires current session/workspace authority and exact stored identity but may remove private working state after its sources are withdrawn. Delete returns only the small receipt, not revoked source content. The fixed adapter receives purpose=delete for that branch; it must not treat this as a read grant. A missing/unknown source binding cannot be invented from model data. Default SQL authority denial remains until this adapter is implemented and reviewed.

Receipt shape:

```json
{
  "request_id": "11111111-1111-4111-8111-111111111111",
  "message_id": "synthetic-assistant",
  "surface_id": "synthetic-surface",
  "surface_revision": 1,
  "revision": 2,
  "deleted": false
}
```

The receipt is the result of **that operation**, not the current head. A creation receipt can still say revision 1 after revision 2 was deleted. A consumer must not resurrect a view from reconciliation; authorized head discovers current status. SQL compares DB-local SHA-256 of normalized JSONB command for retry identity. This is not a portable canonicalization format or source-version identity; API never supplies the trusted digest. No old control payload is retained in receipt rows.

Known success is acknowledged only after transaction commit. SQL errors are not swallowed; ambiguous transport remains unknown. Exact retry is explicit and preserves the entire original command/key. No new request key, latest revision lookup, provider call, model call or workflow restart is automatic. Authorization denial withholds content even if an earlier transaction committed; it does not undo that transaction.

Suggested normalized domain outcomes, to be adopted before public schema work:

- known receipt / exact duplicate: the original receipt, validated against captured chat, message, surface and request identity;
- conflict (`40001`, including stale/deleted/busy): retain draft, show a recoverable choice; deadlock (`40P01`) also cannot become success or fresh writer authority;
- invalid (`22023` and parse/range errors): refuse malformed/changed-key input;
- unavailable/denied (`P0002`/`42501`): no private source text, labels or object details;
- unsupported (`0A000`/`55000`): prerequisite/adapter unavailable, no fallback write;
- transport ambiguity: explicit unknown outcome, original-identity reconciliation.

These are service-internal SQL categories; final user-facing status/error projection must not expose database internals or distinguish inaccessible private identities. No success boolean is inferred from stream finish, void helper return or UI render.

## Preserve newer edits while a save is pending

Capture immutable submitted state or its exact content digest, local edit sequence, scope epoch, request identity and expected server revision when Save starts. Ack A can settle only submission A. If the person makes draft B while A is pending, retain B and mark it unsaved; do not replace controls or mark the whole surface Saved. Advance known server revision monotonically within the same scope/surface; a late ack N cannot roll back observed N+1. A foreign-scope or mismatched-operation/content ack cannot settle either draft. Unknown/conflict preserves submitted evidence and current draft; explicit retry must not quietly substitute B under A's key.

When B is deliberately saved after A succeeds, capture B with a new request identity and the acknowledged current base. If another tab has already changed that base, CAS returns conflict and B stays recoverable. Reconciliation settles only the original submission and must be paired with authorized head before claiming current state. The API/Database never stores browser focus/scroll/playback as business data.

Follow-up contains explicit UI-origin metadata, surface/source revision and exact working revision with allowlisted selection/diff. Server resolves that exact revision; head must not silently upgrade it. No fabricated typed text or whole hidden page is sent to the model. Native/MCP/text projections are derived from the same currently authorized result. Reopen/reconnect/export/duplicate never execute saved action cards.

## Owning implementation map and required acceptance

- Database proposal defines companion placement, lock order, receipts, CAS and tombstones; actual grants/migration/rollback remain separately reviewed work.
- API `lib/supabase/` owns the eventual wrapper call; domain owns strict parsing, source authority and receipt/outcome handling. Do not modify legacy persistence helpers to merge UI state. Enrolled source guard rejects snapshot mutation; unrelated assistant parts may change under a valid captured writer.
- `getSessionChatHandler` and eventual working-read adapters need authorized compound projection; raw full history must not leak a withdrawn working source. No route is changed here. Root coordinates this with UI before integration.
- UI owns temporary/draft/submitted/acknowledged state and scoped lifecycle; Context owns exact source/workspace permission checks. Root owns merges and activation.

Focused acceptance additions beyond App #2373:

1. Actual two connections: create/create and save/save from the same base; one winner, loser conflict, no silent latest-state overwrite. RPC receipt insertion failure after state UPDATE rolls back both state and receipt.
2. Lost acknowledgement → original receipt; changed-key input rejects; rollback → no receipt; read N after N+1 conflicts; new device head has no local key/revision.
3. Source snapshot unchanged through actual fenced write/update_parts and direct owner guard fixture; direct service/legacy/backfill forbidden on enrolled chat. Actual suffix delete clears controls, retains tombstone, old ID cannot return.
4. A save wins before delete and delete wins before save, with actual lock waits; either result is serializable, never restored deleted work. Parent cascade and elevated isolation remain denied by 636.
5. Current membership/source revocation checked on read/retry; read after withdrawal withheld, deletion permitted only with current workspace authority. Lock-race tests specify the authorized transaction can finish before revocation commits; later operations fail. This is not retroactive removal of downloaded exports.
6. UI A pending → edit B → ack A leaves B unsaved; reversed acknowledgements do not lower current revision; account/workspace switch invalidates captured completion; unknown outcome and reconciling old receipt cannot resurrect deleted/latest work.
7. Strict model projection rejects hidden/private/extra fields and unsupported live refs. Local filters and every read/replay cause zero external effects. Intended- actor, two-device authenticated readback remains separately gated and unrun.

The local SQL proof uses actual 636 SQL with synthetic authorization. It is not a full typed API implementation, production policy proof, live storage rollout or UI acceptance. Retention duration/backup expiry, artifact identity, source withdrawal and live mapping need actual owner facts; CAS placement and pending-save semantics are resolved here without asking the user to design them. No operation on a denied live actor is retried as part of this proposal.
