# Disabled small-original HTTP pilot

POST /api/context/originals is disabled unless CONTEXT_ORIGINAL_INTAKE_ENABLED is
exactly true. No environment value was enabled. Activation is a separate release
decision after remaining controls. It is not delegated OAuth/MCP exposure.

Raw application/pdf or text/csv only. Query: sourceId, idempotencyKey, optional
organizationId and mode=store|reconcile. Repeated/unknown metadata, caller
paths/digests/account overrides and query mediaType are rejected. Shared
validateAuthContext supports API-key or Bearer authentication and validates requested
organization before body consumption. Domain operations reauthorize. Body copies at most
4 MiB/10,000 chunks with a 30-second body deadline and request abort cancellation.
Reader cancellation cannot indefinitely delay error return. No Content-Length claim
bypasses actual byte counting. The upload call checks request abort again after its
final authorization and before storage dispatch.

The existing deployed consume_oauth_rate_limit was inspected read-only: atomic
namespace/keys budgets, 60-second expiration, integer retry-after. Shared pilot
namespace caps 8 admissions globally and 1 per authenticated account in that window
across workspaces/cursors/modes. Unavailable limiter fails closed before body read;
rejection gives 429/Retry-After. These conservative engineering defaults are not pricing
or customer requirements. Recovery also consumes admission. Counts are NOT concurrent-
upload leases or retained-byte/storage quotas. At most 32 MiB newly attempted upload
bytes per global window through this route is not a lifetime storage budget, and raw
service writers are outside this path.

After storage dispatch, disconnect does not undo an upload/registration. Named
uncertainty returns 409 needs_reconciliation without paths/internal cause/IDs. The
caller retains the original source/work key and explicitly selects reconcile; it never
allocates a new key or blindly retries/deletes. Body-read cancellation and pre-dispatch
rejection are distinct from uncertain downstream outcomes. Responses are private/no-
store. A disabled binary GET route is included; no browser UI, signed capabilities or
parsing. Actual transport authentication, end-to-end storage/RPC integration and hosted
behavior remain unverified: route fixtures mock the auth/domain boundary; inherited flow
tests exercise real adapters with synthetic Supabase storage/RPC. They are not real
hosted customer operations.

Activation gates: dependencies separately reviewed/approved/released, distributed
concurrency/storage budget and retained/orphan lifecycle, hosted browser validation,
private retrieval/delivery contract, and authenticated complete write/read/ recovery
verification. No upload, customer document, billing/provider call or production mutation
occurred. Refresh included dependency commits after release. Vercel's documented
function payload limit is 4.5 MB; 4 MiB is below that. Internal 50 MiB preparation
remains capacity support, not a client transport promise.
https://vercel.com/docs/functions/limitations

OPTIONS is gated by the same disabled pilot flag. When enabled it advertises only
GET/POST/OPTIONS, the existing explicit token/API-key request headers, and readable
Retry-After. Unsupported methods/custom headers are rejected. It performs no
authentication, admission or body/storage operation. All GET/POST responses include
private/no-store CORS headers with no credentialed browser access. This is synthetic
route coverage, not a hosted browser upload or activation.

GET /api/context/originals accepts only receiptId and optional organizationId;
unknown/repeated fields and Range requests are rejected. The same default-disabled flag,
shared auth and pilot admission budget cover delivery. A write can consume the account's
single admission, so immediate readback may wait for Retry-After; this conservative
budget must be evaluated before activation.

The existing retained reader accepts a trusted server byte bound: receipt metadata over
4 MiB is denied before download, then actual Blob size and retained digest/type are
checked and current receipt/access/withdrawal reread before response. GET returns a
private/no-store attachment with fixed original.pdf/original.csv filename, explicit
verified media type and nosniff. It returns no path, signed capability, receipt metadata
or accepted-analysis assertion. Disconnect before/after read withholds the response;
this does not cancel an in-flight storage download.

Retained delivery uses the installed storage SDK stream and the existing bounded reader,
with a 30-second download deadline covering headers and body, plus cancellation on
overflow. Authorization is point-in-time, not a lock across HTTP delivery or retroactive revocation of delivered
bytes.

All 163 original/route fixtures pass locally, including 14 GET cases, 8 payload-bound
reader cases and inherited actual-byte/default-storage boundaries. Route fixtures mock
shared auth/domain; they do not prove hosted authentication or a complete
write/read/recovery transaction. No intake environment was enabled. Larger retained
originals are withheld rather than truncated. Distributed concurrency, retained
storage/orphan lifecycle, explicit legacy recovery and hosted authenticated synthetic
roundtrip remain activation gates.

Streaming delivery limits copied application bytes and chunk count before Blob creation.
It cannot bound an upstream chunk allocation or total concurrent memory. Header wait
and body consumption share the same scoped, abortable deadline. The service SDK's
default Blob path remains for
registration verification callers that omit the bound; that path does not acquire a
streaming memory guarantee. These limits remain activation considerations, alongside
storage/orphan controls.

Seven integrated lifecycle fixtures now keep shared API-key/Bearer-key auth, workspace
authorization, domain operations and storage/RPC wrappers real against a synthetic
backend. They cover module-reset retained readback, committed-save lost reply and
no-upload recovery, invalid credentials, revoked scope before recovery/delivery, and
withdrawal or membership revocation during SDK download. The scoped SDK fetch is
checked for the private bucket URL and synthetic service authentication. Backend
receipt persistence, access denial and admission responses are simulated: these tests
do not prove database transaction semantics, actual limiter windows, hosted HTTP or
production storage behavior. Test-only enabled environment is removed afterward; no
real environment is activated. Hosted roundtrip and lifecycle resource controls remain
gates.
