# Agent platform routes: lazy startup

## Scope

This repairs the shared cold-import residual of API #297
(`8e907cead1e77a06352a8b0acc6867549ba6d297`) and #264
(`5a6c39ad3f20074789c653109a6cdd30073e979d`). Initial main:
`018779985065557367e60e7622206995747c8783`, composed onto
`bc817e1e92f495cdeee18d606ed79f8d185b980e`. The intervening OAuth discovery
diagnostic repair touches separate files. The prior challenge-only
repair is recorded in `slack-webhook-verification.md`; #1142 already repaired
the separate `get_tasks` error and is not part of this change.

Coding and content dynamic platform routes previously imported bot singleton
and handler modules at file evaluation. These construct adapters and Redis
state before a request's platform or signature can be checked. The installed
Chat SDK also initializes state/adapters before adapter signature verification,
so merely moving imports into `getBot` is insufficient.

The shared route now checks platform parameters and the declared adapter names,
then the existing app's signature, before importing bot or registration modules.
The names mirror the current bot factories: coding Slack/GitHub and optionally
WhatsApp; content Slack. They are routing metadata, not user/channel allowlists.
WhatsApp stays optional using the existing complete-group configuration check.

Slack uses the existing raw-body HMAC and five-minute replay check. GitHub and
WhatsApp use the same SHA-256 HMAC/header as their installed adapters. Requests
are cloned for inspection; the SDK receives the original bytes and continues
to perform its own verification. Signed Slack challenges and WhatsApp GET
verification return before state startup. Invalid WhatsApp verification remains
403; bad signatures are 401; unsupported platforms are 404. An unconfigured
content bot returns 503 after successful signature verification. Consequently,
an unsigned event to an unconfigured content bot now returns 401 before the
configuration check, rather than its former 503.

Valid events import the existing singleton and registration module. Module
caching retains one registration and the same bot/state instance. The SDK's
webhook performs initialization; the route no longer calls it separately.
The `waitUntil`/Next `after` contract is unchanged. Loading/adapter failures
return a bounded 500 without exposing raw errors. No new credentials or
authorization model, channel/user allowlists, mandatory WhatsApp configuration,
state key prefixes, callback logic, PR merging or provider jobs are introduced.

## Verification and limits

Ten initial cold-import tests failed on the unchanged base. The expanded tests
import the actual routes and singleton modules with inert Redis/state/adapter
doubles and the real Chat SDK. They assert no construction for early rejections,
valid handshakes, coding/content state prefixes, once-only registration before
SDK initialization, reuse, unchanged bodies, signed GET delegation and a bounded
construction-failure response. Separate checks use the actual installed Slack,
GitHub and WhatsApp adapter classes with inert event payloads, comparing signed,
missing, wrong, malformed and tampered signatures and WhatsApp GET responses.
All run offline with a process-level network guard.

These tests do not establish hosted provider configuration, real delivery,
callbacks, Redis persistence, PR merges or user installation. The static
`/api/coding-agent/github` feedback endpoint and `/api/chat/slack` are separate
routes and unchanged; this is not a claim that every bot entrypoint is lazy.
Historical #264 allowlist/configuration/diagnostic acceptance remains outside
this bounded repair. Neither original PR nor linked issues are closed here.
