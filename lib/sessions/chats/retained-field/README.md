# Retained-field history withholding (2207)

The existing GET `/api/sessions/{sessionId}/chats/{chatId}` now invokes this gate
before serializing saved messages. It does not activate retained-field production
or grant disclosure. The current-authority boundary has no implementation and
returns unavailable. There is deliberately no positive release branch, including
for an unexpected or cached `ready` value.

## Actual call graph

`route.GET` → `getSessionChatHandler` → `validateGetSessionChatRequest`
(authenticated account, session ownership, chat membership) → `selectChatMessages`
→ `filterRetainedFieldHistory` → `hasRetainedFieldContent` →
`readRetainedFieldDisclosure` → omission of the entire marked message.

The validator returns the actual authenticated account separately from the chat.
The gate passes that account, validated session/chat IDs and database message ID;
none comes from the saved message's claimed owner, workspace, actor or anchors.
The saved content remains untrusted input to any future authority implementation.
No workspace authority is inferred from session ownership.

`persistAssistantMessage` stores a full AI SDK UIMessage in `chat_messages.parts`.
Removing only its companion would leak sibling text, tables or metadata. The gate
therefore omits the whole stored message. Legacy array-shaped parts are inspected
as well. Unrelated messages retain their original values and order. A successful
response is explicitly private/no-store; empty filtered history remains a 200.
Existing auth and storage error behavior is preserved.

## Reserved family and limits

The proposed App envelope is `data-retained-field-snapshot` with capability
`retained-field-companion/1`, holding the unchanged schema-v1 surface alongside
`catalog-retained-field-projection/1`. Detection examines structured discriminants
throughout the saved JSON, including malformed payloads and unknown versions in
these reserved families. It also recognizes structured `mode: retained_field`.
It does not parse text, infer numeric meaning or extend schema-v1. This is a deny
classifier, not an admission schema or producer negotiation implementation.

This default-denied source integration intentionally withholds even a legitimate
historical retained-field message. Current-source read and publication locking,
exact selection/method/projection validation, batch authorization and a reviewed
transport are still required before any positive branch can be added. A callback,
local flag or successful earlier computation cannot replace them.

The boundary never fetches latest, re-keys, retains, expands, calls a provider or
falls back to legacy raw-report authority. No SQL, grants, flags or routes are
introduced. Frozen API1291/Database143 consumers are not imported or modified.

This qualifies this GET history consumer only. It cannot identify unmarked prose
in a separate message as derived, revoke an already delivered client object, or
qualify initial-send/replay/export/model inputs and other history endpoints. Those
paths and a provenance-preserving producer remain separate activation gates.

## Negative acceptance

The route tests invoke the real GET, handler, validator and gate with synthetic
auth/storage boundaries, prohibit network access and verify whole-message removal,
mixed text/numeric projections, malformed/unsupported family markers, stored ready
and local disclosure flags, real actor/anchor propagation, thrown failure with no
retry, and unchanged legacy reports/controls. Injected withdrawn/stale/ready states
are adversarial boundary results, not claims of actual SQL withdrawal qualification.
No authenticated production/history request is executed.

Run `pnpm exec vitest run lib/sessions/chats/__tests__`.
