# Session chat model fallback

## Scope and original intent

API #556 at `20fa9066adf72571a54e24f12f99d002d3e0de6a` mapped a null
`chats.model_id` to `DEFAULT_MODEL` in `lib/sessions/toChatSummary.ts`.
The replacement introduced by #552 returned the raw nullable value instead.
Neither PR description nor the replacement mapper history records a decision
to retire the per-chat fallback. A top-level `defaultModelId` does not supply
the missing value inside each chat summary.

The current main-branch base for this repair is
`df6c10c093d9780de2d18dcf82b1aa8adfb89e3b`. The sole runtime caller of
`getChatSummaries` is `getSessionChatsHandler`, reached by canonical
`GET /api/sessions/{sessionId}/chats`. This repair uses the current shared
constant, preserves saved model IDs, and changes no stored rows. It does not
change individual-chat responses or claim a verified frontend model selection.

## Offline verification (2026-10-25)

- New mapper and canonical GET regression tests failed before the fix: three
  failures on null model IDs, with the read-failure/empty-list control passing.
- All 134 tests across 24 session/chat and Supabase adapter test files pass.
  They include existing owner validation and failed-read checks, plus model
  fallback, explicit saved model, ascending ordering, input non-mutation,
  account-scoped read lookup, unread state, streaming state, and route response.
- ESLint, Prettier, and `git diff --check` pass for the changed source/tests.
- Full TypeScript checking fails with 218 existing diagnostics. The candidate
  output is byte-identical to a separate unchanged base checkout using the same
  dependencies and Node 24.18.0; no new diagnostics were introduced.

No credentials, environment files, live database, model/provider execution, or
customer writes were used. Source tests do not establish deployment or live
authenticated behavior. Merge and release verification belong to the
coordinator under the existing Mono #358/#360/#321 scope.
