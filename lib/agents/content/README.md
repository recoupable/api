# Slack content artist selection

New requests have no default account or artist. The signed Slack workspace/member
must have an explicit deployment binding, and the request must name exactly one
artist from that Recoup account's direct or organization roster.

## Configure before enabling new requests

Set `SLACK_CONTENT_ACCOUNT_BINDINGS` in the API deployment environment to a JSON
object of `"<Slack workspace ID>:<Slack member ID>"` → Recoup account UUID, for example:

```json
{ "TEXAMPLE:UEXAMPLE": "10000000-0000-4000-8000-000000000001" }
```

These are placeholders, not a working grant. An administrator must verify the
Slack member and the Recoup account owner before adding a binding. Bind each member
to their intended account; the account owns the repository and pays for generation.
Do not infer identity from Slack email, display names, message text, or another bot's
credentials. Remove the binding to revoke the member's ability to start new runs.
The binding itself is an explicit authorization grant, not an automatic account link.

The installed Slack adapter verifies webhook signatures and supplies the signed
event's `team`/`team_id` and `user`. The author must match that signed member. Missing,
malformed, unknown, conflicting or bot identities fail closed before AI parsing.
Missing/invalid bindings reject **new generation only**: the bot's existing startup
configuration, callbacks and polling are not disabled, so in-flight work can finish.

## Request and rejection behavior

Example: `Make two videos for North Star using the song Example Song.`

- The prompt parser extracts requested artist names with no default. An AI failure
  therefore cannot fall back to the former fixed artist.
- Exactly one nonempty extracted full name must occur literally in the request
  (case-insensitive, at word boundaries). Model output is not authorization.
- Match only that account's direct and organization artist roster by full name,
  case-insensitively. No fuzzy match, first-match selection, global search or admin
  roster expansion. Unknown/out-of-roster names receive the same rejection.
- Duplicate display names or colliding content-directory slugs are rejected; duplicate
  ownership rows for the same artist are not a second artist. Resolve roster ambiguity
  before retrying. A model-extracted request for multiple artists is also rejected.
- Directory names containing path separators, percent escapes or URL modifiers,
  and the dot/dot-dot segments, are rejected before they can redirect worker file lookups.
- Roster errors or server-truncated results fail closed instead of selecting from a
  partial list. Very large rosters beyond the database response cap need a separately
  verified pagination change before this bot can use them.
- Recheck artist access and the selected artist's slug before handling attachments
  or triggering work. Do not switch to the artist account's repository if readiness
  lookup fails; both lookup paths use the bound requester's account.

This is a bounded Slack handler fix. It does not change REST content-create auth,
the generation/publishing pipeline, billing rules, callbacks, or other Slack bots.
It does not prove semantic extraction accuracy for arbitrary natural-language prompts
or hosted delivery. Verification uses provider-free handler, schema, roster and
installed-SDK tests; do not generate real content just to run these tests.

## Local checks

```sh
pnpm exec vitest run lib/agents/content lib/supabase/accounts lib/slack/__tests__/webhookVerification.test.ts
pnpm lint:check
```

Before release, configure verified workspace/member bindings. Without them, this
change intentionally refuses all new content requests. Merge/deployment approval
does not implicitly grant any Slack member access to a Recoup account.
