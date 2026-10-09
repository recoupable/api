# Disabled small-original HTTP pilot

POST /api/context/originals is disabled unless CONTEXT_ORIGINAL_INTAKE_ENABLED
is exactly true. No environment value was enabled. Activation is a separate
release decision after remaining controls. It is not delegated OAuth/MCP exposure.

Raw application/pdf or text/csv only. Query: sourceId, idempotencyKey,
optional organizationId and mode=store|reconcile. Repeated/unknown metadata,
caller paths/digests/account overrides and query mediaType are rejected.
Shared validateAuthContext supports API-key or Bearer authentication and validates
requested organization before body consumption. Domain operations reauthorize.
Body copies at most 4MiB/10,000 chunks with a 30-second body deadline and request
abort cancellation. Reader cancellation cannot indefinitely delay error return.
No Content-Length claim bypasses actual byte counting. The upload call checks
request abort again after its final authorization and before storage dispatch.

The existing deployed consume_oauth_rate_limit was inspected read-only: atomic
namespace/keys budgets, 60-second expiration, integer retry-after. Shared pilot
namespace caps 8 admissions globally and 1 per authenticated account in that
window across workspaces/cursors/modes. Unavailable limiter fails closed before
body read; rejection gives 429/Retry-After. These conservative engineering defaults
are not pricing or customer requirements. Recovery also consumes admission.
Counts are NOT concurrent-upload leases or retained-byte/storage quotas. At most
32MiB newly attempted upload bytes per global window through this route is not a
lifetime storage budget, and raw service writers are outside this path.

After storage dispatch, disconnect does not undo an upload/registration. Named
uncertainty returns 409 needs_reconciliation without paths/internal cause/IDs.
The caller retains the original source/work key and explicitly selects reconcile;
it never allocates a new key or blindly retries/deletes. Body-read cancellation
and pre-dispatch rejection are distinct from uncertain downstream outcomes.
Responses are private/no-store. No binary read route, preflight/browser UI,
signed capabilities or parsing. Actual transport authentication, end-to-end
storage/RPC integration and hosted behavior remain unverified: route fixtures
mock the auth/domain boundary; inherited flow tests exercise real adapters with
synthetic Supabase storage/RPC. They are not real hosted customer operations.

Activation gates: dependencies separately reviewed/approved/released, distributed
concurrency/storage budget and retained/orphan lifecycle, browser preflight if
needed, private retrieval/delivery contract, and authenticated complete write/read/
recovery verification. No upload, customer document, billing/provider call or
production mutation occurred. Refresh included dependency commits after release.
Vercel's documented function payload limit is 4.5MB; 4MiB is below that. Internal
50MiB preparation remains capacity support, not a client transport promise.
https://vercel.com/docs/functions/limitations
