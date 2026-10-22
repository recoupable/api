# Validate task schedules before side effects

Bounded successor to the cron-validation slice of original API #291, head
`845d0e79c524c4e50d12993994667c3d4502e849`. The original broad patch contains many unrelated changes;
this implements only its missing schedule-validation outcome against current schemas.

## Behavior

POST and PATCH task requests now reject malformed supplied schedules through the
owning Zod schemas, using the existing 400 status/error/missing_fields envelope
and CORS headers. The same refinement reaches MCP inputs and direct create/update
persistence schemas. Invalid direct calls fail before database access or scheduler
calls. Omitted schedules on ordinary patches retain their existing behavior.

Current creation inserts a scheduled_actions row before creating its Trigger
schedule. Early syntax rejection prevents that row insertion for rejected inputs;
it does not make the entire multi-service create operation transactional or fix
other failures after insertion. No historical rows or schedules are changed.

The original numeric-only regex would reject valid provider syntax. This uses
pinned, maintained cron-parser 5.10.2 instead. Trigger's inspected public source
uses the v4 parser family with a no-seconds field limit. A retained 16-case v4/v5
syntax comparison agrees for ordinary expressions, aliases, names, last-day and
nth-weekday expressions, combined day restrictions and invalid inputs. This is
bounded compatibility evidence, not exhaustive provider equivalence.

Only the existing five provider aliases are accepted; v5-only randomized/hashed
syntax and new aliases are excluded. Blank input and explicit seconds fields,
including whitespace-separated seconds, are rejected. Validation uses field-specific names/characters and a temporary deduplicated
expression, preserving provider-supported overlapping lists despite v5 duplicate
rejection. That temporary form is never stored or sent: the original expression
remains unchanged. Provider-v4 explicit month/day constraints are also retained
when a restricted weekday is present. The provider retains final authority; local acceptance
is not proof a hosted schedule exists or will run.

## Boundaries

No new Trigger task, worker change, manual deployment, live schedule creation,
provider job, paid operation, database migration, account-access rule, model,
timezone or plan limit is introduced. Existing cadence/plan interpretation and
read-time blocking remain unchanged; this is syntax validation only. Re-enabling
or editing a task without a new schedule does not retroactively validate its
stored schedule. Backend outages and partial-create recovery are outside scope.

Tests cover the owning REST/MCP/persistence schemas, actual HTTP validators and
direct create/update functions with auth/database/scheduler leaves mocked. They
prove early rejection and the existing response shape, not a live customer,
OAuth client, provider schedule, scheduled execution or billing outcome.

Provider source: [Trigger CronPattern](https://github.com/triggerdotdev/trigger.dev/blob/main/apps/webapp/app/v3/schedules.ts)
and [supported schedule syntax](https://trigger.dev/docs/tasks/scheduled#supported-cron-syntax),
checked October 21, 2026. Parser implementation and syntax are additionally
checked from the installed pinned package. No live provider call is required.

## Independent-review corrections

Records rejected the initial wrapper: global alias handling admitted month/weekday
names in the wrong field and minute `?`, while v5 duplicate checks rejected valid
overlapping lists. Regression fixtures reproduce these failures through shared
schemas, direct create/update calls and HTTP validators. They also verify supported
overlapping lists reach mocked persistence and scheduler calls unchanged. The
correction is confined to compatibility validation and its tests; auth, ownership,
plan/cadence, timezone and the seven-file scope remain unchanged. Earlier green CI
did not clear this hold. The corrected revision needs fresh checks and Records
acceptance before a release decision.

The corrected compatibility check also compares 420 bounded cases against the
retained provider-family parser, with zero acceptance differences in that
matrix. It includes field-specific aliases/tokens, duplicate/range/step lists,
last-day/nth-weekday syntax and month/day combinations. This is not universal
equivalence or evidence a schedule will fire. Legacy duplicate-month acceptance
is preserved during temporary validation; no stored expression is normalized.
