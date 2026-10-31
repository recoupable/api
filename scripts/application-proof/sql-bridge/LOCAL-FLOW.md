# Disabled local application lifecycle

October 30, 2026. Related: [Sites #2104](https://github.com/recoupable/app/issues/2104).
This implements the adopted **local engineering direction**: personal-account,
non-billing registration → proof → status using synthetic data. It is not approval
of production management roles, retention or a hosted pilot.

## Run the concrete flow

Use the existing runner with PostgreSQL on PATH and a local Database checkout:

```sh
python3 scripts/application-proof/sql-bridge/run.py --database-repo /absolute/path/to/database
```

`lifecycle.integration.test.ts` is the executable example. It creates two synthetic
personal accounts, registers `.example` origins without a Site, and exercises
production/development bindings. It calls the real registration validator and
creates application/environment/origin parents atomically in `proof_parent_fixture`.
The generated application UUID is a local identifier, never a credential. Billing
attribution stays on the same personal workspace and creates no balance or allowance.
Registration rejects any organization field, unenrolled actor or non-`.example`
hostname. Enrollment is an explicit constructor fixture, not a real authorization
record or an account-type detector. The default empty enrollment denies everything.

The factory has no route, MCP registration, feature flag or hosted connection input.
Every SQL call uses the existing runner-created Unix socket and marker guard. The
test intercepts organization-access imports and throws if membership is queried;
it supplies no Supabase credentials. Running outside this test harness is unsupported.
Reserved hostnames are data only: no DNS or HTTP request occurs.

```ts
const app = await flow.register(syntheticActor, registrationInput);
const target = { actor: syntheticActor, application: app.application_id,
  environment: "production", origin: "https://music.example" };
const issue = flow.prepareIssue(target, "retained-issue-key");
// Retain issue.request and issue.nonce BEFORE dispatch.
const challenge = flow.replay(issue.request);
const verify = flow.prepareSyntheticVerification(target, "retained-verify-key",
  challenge.challenge_id, [["recoup-app-v1=" + issue.nonce]]);
const receipt = flow.replay(verify);
const status = flow.status(target);
flow.replay(flow.prepareRevoke(target, "retained-revoke-key"));
```

Preparation captures revisions, caller key and exact payload without executing the
proof mutation. `replay` executes the unchanged Database transaction and checks
receipt binding/disabled flags. A lost response must be recovered with the retained
request; do not prepare a new nonce, observation, baseline or key. This sample does
not automatically retry. Registration itself is single-shot fixture setup, without
a durable creation-idempotency protocol; an uncertain registration outcome requires
fixture inspection/teardown, not an automatic rerun. This limitation blocks treating
the factory as a runtime registry adapter, not the local composed demonstration.

Synthetic verification bounds supplied TXT records and reuses the existing frozen
contract model for TXT chunk assembly and digest matching. It then submits a
`synthetic-v1` observation to the actual pinned SQL, which rechecks binding,
freshness, expiry, authority and revisions at commit. The database clock provides
the synthetic observation timestamp. Neither constructor enrollment nor a caller's
records prove real identity or DNS control. The low-level replay method is a trusted
fixture seam; it is not a public input-validation or resolver provenance boundary.

Status holds the fixture authority lock while reading the requested application's
configuration snapshot and that origin's historical proof receipts. It returns
`production_persisted: false`, `bootstrap_enabled: false`, `access_activated: false`.
Historical verification is not a reusable lease or current access grant. Status
remains readable after origin revocation to a currently authorized fixture actor;
revoking that actor's authority denies reads and retries too.

The fixture override is loaded only by tests. Restoring the original SQL authority
adapter makes status deny despite the synthetic enrollment and authority rows.
Registration writes test authority records as part of fixture setup; it never
changes PostgreSQL roles or grants. Real grant provisioning and least privilege
are deliberately absent.

## What the added tests establish

Six composed scenarios cover successful registration/issue/verify/status/revoke;
two unrelated accounts and environment isolation; absent enrollment, organization
override and real-host rejection; atomic parent rollback and original SQL denial;
return-URL update invalidating a prepared observation; and separate TXT records,
expired challenge, stale revisions and revoked authority rejection. The existing
ten bridge tests remain in the same serial suite because both files share one
disposable database. No shared mutable fixture runs in parallel.

The loader now freezes the fifth existing API module, `contractModel.ts`, alongside
the four original validator/rehearsal modules. Database source pins and SQL remain
unchanged. PostgreSQL 15/17 CI executes this expanded suite. Ordinary unit runs skip
it without the runner socket; skips are not lifecycle acceptance.

## Remaining narrow boundaries

No production registry/storage, roles/grants, resolver, DNS publication, customer
retention interval, billing policy, provider configuration, fan session or bootstrap
is implemented. Production parent mapping, trusted actor/credential handoff,
least-privilege execution, retention/replay tombstones and resolver eligibility
remain runtime work. No synthetic history may be migrated into real proof evidence.

This delivers a reversible source-level #2104 flow. It does not satisfy #2110's
independent-host/provider/mobile/billing acceptance or change #2345's browser hold.
No blocked browser operation was retried and no live activation is enabled.
