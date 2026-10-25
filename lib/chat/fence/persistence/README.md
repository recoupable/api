# Disabled required persistence adapter

Source baseline: API `9b92f80ddb817d90201dbebbf1723662266e2d14`. Contract: Context
SQL/harness `61d8b530f8b960b32402f4dd1f0d0a8f4f83d76e`, tree
`08bbb524033e34238ab6f4cf96dd1be581d874a0`. This module has no production caller,
enrollment switch, migration, credential operation, or current-authority lookup.

`createFencedMessageWriter(capturedWriter, executeChatFenceCommand)` validates and
captures chat/account/epoch/owner/original bound run once. It sends the complete
`UIMessage` in the database `parts` field, preserving metadata and data parts.
User insert returns `inserted | exactDuplicate`; assistant upsert returns
`inserted | exactDuplicate | updated`. `updateAssistantParts` requires an existing
assistant and returns `{ updated: true }`; a missing row throws. All persistence-operation failures
throw a classified `FencedPersistenceError`. No retries, logging, title updates,
activity writes, provider calls, or release operations happen in the adapter.
`retrySameCommand` describes the existing error classifier's advice, not permission
to reacquire authority or automatic retry. Ambiguous delivery remains unresolved.

## Inspected production call graph

| Caller | Current behavior | Required later patch |
| --- | --- | --- |
| `lib/chat/handleChatWorkflowStream.ts:92` | Fire-and-forget latest user helper, before `start` at 125; legacy pending-slot claim/promotion | Remove this write from the enrolled route; await user persistence after the workflow's original authority binds, before provider work |
| `lib/chat/persistLatestUserMessage.ts:38` | Full user object, legacy insert-only upsert; catches failures at 81 | Required fenced writer on the enrolled path; extract title/activity as separately repairable ancillary work |
| `lib/chat/runs/handleStartChatRun.ts:56` | Starts the same workflow, without the interactive user persistence call; later best-effort legacy claim | Use the same first-bound-step user persistence path for headless and interactive starts |
| `app/lib/workflows/persistAssistantMessageStep.ts:25` | Awaits a helper which swallows errors | Enrolled step awaits the adapter and lets required failures terminate the turn |
| `lib/chat/persistAssistantMessage.ts:22` | Full assistant object, legacy upsert/update, activity update; catches at 39 | Assistant generation-checked upsert; ancillary activity separate |
| `app/lib/workflows/runAgentWorkflow.ts:150,174,206` | Catalog result, routing metadata, then each model iteration await the legacy assistant step | All three sites pass the original captured writer identity and await required acknowledgement |
| `lib/chat/auto-commit/autoCommitChatTurn.ts:90` → `lib/chat/persistAssistantDataPart.ts:46` | External commit then direct full-message update; failed update only logs | Preserve the merged full object and await fenced `update_parts` before successful completion; never rerun the external commit just to repair persistence |
| `lib/supabase/chat_messages/upsertChatMessage.ts` | Duplicate means ignored conflict, not exact-content verification | Leave legacy default unchanged; enrolled calls use existing `chat_fence_command` boundary |
| `lib/supabase/chat_messages/upsertChatMessages.ts:17` → `scripts/backfill/migrateRoom.ts:75` | Backfill constructs full objects, preserves historical timestamps, continues failed rows then throws aggregate | Separate explicit historical migration lane or skip fenced chats; never borrow the current writer epoch |

## Minimal later wiring sequence (not implemented here)

1. Resolve the missing authoritative resource authorization decision and approved
   credential lifecycle before enrollment. Existing auth observations identify
   sources only; they do not supply policy versions, permissions, grants, or safe
   recovery authority. Existing recovery denial remains intact.
2. Carry the existing immutable admission authority and original dispatch attempt
   into the workflow. Its first step binds the actual workflow metadata run ID
   using that attempt. Only a successful bind can create this writer. Remove the
   enrolled route's post-start promotion/legacy cancellation assumption. A losing
   run must stop before provider work or another run's cleanup.
3. Add a required first-bound-step user insert shared by interactive/headless
   entry points. Await it before routing (which can itself call a model), catalog
   work, agent work, or a success response. Do not simply add `await` around the
   current swallowing helper: that would still turn a failed write into success.
4. Add an enrolled persistence step taking the serialized captured writer, then
   calling this adapter through the existing Supabase command boundary. Use it at
   all three assistant sites above. Convert permanent/ambiguous required failures
   into terminal step failures (the compiled fixture demonstrates `FatalError`),
   with explicit reconciliation for ambiguous outcomes. Do not let workflow
   platform defaults silently replay an entire provider turn. Explicit retries
   may only reuse the original command and authority under an approved policy.
5. Route assistant data-part persistence through `updateAssistantParts` with the
   same authority. A missing target is a failure. Complete the required update
   before `workflow_complete` release. Existing streaming/provider/commit effects
   may already have occurred; persistence failure does not undo those effects.
6. Replace enrolled unconditional legacy `clearChatActiveStream` in `finally`
   with correctly scoped terminal/reconciliation handling. Send success release
   only after required writes finish. Stream closure is transport cleanup, not
   proof of successful persistence. The actual-caller tests deliberately show
   that legacy cleanup still runs today; they do not claim this gap is fixed.
7. Give an edited/replaced user message a fresh ID and a genuinely new assistant
   turn a fresh ID **and** fresh pending assistant object. Only a proven same-turn
   resume may retain both original assistant identity and captured authority.
   SQL rejects tombstoned IDs and old/historical assistant generations. Identical
   user replay across generations remains allowed by the pinned SQL contract.
8. Title and activity updates run after confirmed message persistence and remain
   conditional/repairable. `inserted` can select a first-attempt action but is not
   an exactly-once event receipt: a committed write with lost acknowledgement
   replays as `exactDuplicate`, and an ancillary update can fail independently.
   Repair from persisted messages with a conditional title update; use monotonic
   activity updates so old repair work cannot overwrite newer activity.
9. Audit every live writer and the backfill lane before any fence enrollment.
   Keep legacy callers unchanged for unenrolled chats. No rollout flag or wiring
   is added by this PR.

## Status — 2026-10-25

Disabled implementation complete for review. Spec and Standards reviews found no
blocking issues; constructor-validation wording was corrected. Local qualification
passed the scoped foundation checks (strict and production-compatible typing),
compiled workflow, 21 SQL cases with full-message readback, and 22 adapter/caller/
SQL-roundtrip tests. The broad suite's nine localhost-listener failures passed on
an isolated permitted-listener rerun; no live service was contacted. Exact-head CI
and sealed evidence are recorded in the PR handoff. Next action: owner review and
merge, followed by separately authorized wiring under the prerequisites above.
Production integration, authoritative resource authorization, recovery, and
rollout remain blocked prerequisites rather than completed behavior.

## Evidence and reproducible checks

- `createFencedMessageWriter.test.ts`: typed outcomes, full object, immutable
  identity, SQL failures, ambiguous transport without retry, missing targets,
  malformed JSON/accessors/receipt rejection.
- `runAgentWorkflowFencedPersistence.test.ts`: actual workflow with a test-only
  step substitution; routing-metadata failure stops the agent provider, iteration
  failure stops the next provider and post-loop effects, pending acknowledgement
  is awaited. Legacy finally cleanup is explicitly asserted as a remaining gap.
- `scripts/chat-fence-fixture`: actual compiled Workflow fixture; required user,
  preflight assistant, iteration assistant and final parts failure prevent later
  synthetic provider/success-release effects. Original bound run/epoch are
  checked for every write. Its provider/persistence effects are synthetic.
- `sqlPersistenceVectors.test.ts` generates commands through the actual adapter
  and RPC boundary, plus admissions through the existing canonical builders.
  Credential policy values in these fixtures are synthetic test data only.
- `test-sql-persistence.py` loads unchanged SQL and harness from the exact Context
  commit into a disposable socket-only PostgreSQL cluster. It checks 21 actual
  SQL outcomes: inserts, exact replays, update, parts/missing target, user conflict,
  stale writers, prior/historical assistants, cross-generation exact user replay,
  and tombstoned IDs. One committed response is deliberately discarded at a
  synthetic transport seam; explicit original-command replay returns duplicate.
  This is not a real network fault injection or hosted recovery qualification.
- Feeding its result JSON back through the TypeScript test validates actual SQL
  receipts and error codes through the existing RPC boundary and required writer.

```sh
pnpm test:chat-fence-foundation
pnpm exec vitest run app/lib/workflows/__tests__/runAgentWorkflowFencedPersistence.test.ts
CHAT_FENCE_PERSISTENCE_SQL_RESULT=/private/tmp/persistence-sql-results.json \
  python3 scripts/chat-fence-fixture/test-sql-persistence.py /path/to/database
CHAT_FENCE_PERSISTENCE_SQL_RESULT=/private/tmp/persistence-sql-results.json \
  pnpm exec vitest run lib/chat/fence/persistence/__tests__/sqlPersistenceVectors.test.ts
```

No evidence here establishes production fencing, live provider behavior, safe
credential recovery, migration readiness, or exactly-once external effects.
