# Read-only stored credits compatibility

## Contract and scope

Existing API #286 at `d53fa2eec6691ea048f27ec63415bc0fafe2ba35` proposed
`GET /api/credits/get?accountId=<uuid>` returning the first stored credits usage
row under `{ data }`, or `{ data: null }` when none exists. This repair starts
from main `88500729086ac55bd276afac69b930a77953a7be` under the existing
Mono #318/#358 reconciliation scope. It restores that read-only data shape with
current authentication and account authorization, not an unauthenticated read.

Send exactly one `accountId` UUID and exactly one authentication mechanism:
`x-api-key` or `Authorization: Bearer`. Existing Recoup API-key lookup/expiry
checks, Privy identity verification and target-account rules remain shared with
the enriched endpoint: self, authorized organization/shared membership or
existing Recoup admin access. No access is granted by the query alone.

The route opts into `allowAccountCreation: false`. A Privy identity without an
existing account receives 401; it does not create an account or send welcome
email. Normal Privy identity verification may perform its existing read-only
provider lookup. Existing callers keep account creation enabled by default,
including canonical account-credit reads. The compatibility route does not
change onboarding, billing or permission policy elsewhere.

### Responses

- 200: `{ data: <stored credits_usage row> }` or `{ data: null }`.
- 400: `{ status: "error", error: "accountId must be a single valid UUID" }`
  for missing, malformed or repeated `accountId`.
- 401/403: existing typed authentication/account-access envelopes, using
  `status: "error"` with `error` or the existing authentication `message` field.
- 500: `{ status: "error", error: "Failed to load credits usage" }` on an
  unavailable credits read or unexpected handler failure; raw errors are hidden.

All responses, including denials and preflight, use `Cache-Control: no-store`
and standard CORS. The route also exports the repository's force-dynamic,
force-no-store and revalidate-zero settings.

The data is the raw stored row selected through the existing
`lib/supabase/credits_usage/selectCreditsUsage.ts` wrapper with an authorized
`account_id` filter. The original row had `id`, `account_id`,
`remaining_credits` and `timestamp`. The current table also stores
`auto_topup_enabled`, `auto_topup_amount`, `auto_topup_threshold`,
`auto_topup_last_run_at` and `auto_topup_last_error`; these stored fields are
passed through without calculating new financial values. No row is created
when it is absent. Stored balances/timestamps may be stale; no reset, refill,
top-up, plan lookup, Stripe call or enrichment runs here.

`GET /api/accounts/{id}/credits` remains the enriched resource: its existing
initialization/refill and plan-derived response behavior is unchanged. Callers
who need those semantics should continue using it. This compatibility path is
for reading the stored snapshot without those operations.

## Verification and retained acceptance

Tests invoke the actual compatibility route with real shared authentication and
target-access logic, while mocking identity verification and database wrappers.
They cover API-key headers, API-key Bearer, existing Privy, unknown Privy,
expiry, denied targets, shared membership/organization/admin access, raw rows,
missing rows, query validation, sanitized failure and no-store responses. Every
case asserts no account creation, welcome email, credit initialization/reset,
insert/update/refill or auto-top-up function call. Wrapper tests verify the
filtered raw SELECT and failure/empty distinction. Shared-auth regressions
retain default onboarding behavior and test the explicit opt-out.

All execution is offline and provider-mocked. These tests do not establish
deployment, live token validity, account membership, actual balances, billing
correctness or a real financial operation. Source supersession of original
#286 and any hosted acceptance remain separate coordinator decisions. No
credentials, environment files, customer/account writes or live financial
operations are part of this repair.
