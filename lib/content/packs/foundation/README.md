# Optional retained artwork foundation — unwired candidate

This candidate advances app issues2273/2268 without adding a quoted item, provider stage,
reservation, model, cap or production registration. The production workflow and bounded
scheduler are unchanged. The caller must supply one already-admitted workflow's durable
ports before any hosted integration; these ordinary async functions are not a newly
qualified Workflow registration.

`createPackFoundationPlan` selects an explicitly requested **existing quoted artwork**,
otherwise the lowest ordinal/ID existing quoted artwork. It rejects retry-only/stale
quotes, unknown dependencies and self-dependency. No quoted artwork is `none_requested`;
quoted artwork missing from persistence is `missing`. Neither creates a replacement.

Dependencies are explicit asset IDs, not a new default for every asset. All five current
kinds begin with `createPackProductionServices.generateImages`, which already supplies
`image_urls` to `buildImageInput`. That adapter uses its existing edit route for references.
The foundation adds a retained image reference to the same already-quoted image call;
it does not add another image-generation call. Original references remain and the existing
five-reference pack limit is enforced. Extra recipes, new provider capabilities and
incremental funding are outside this candidate. Provider expenses remain unmeasured;
using an already-configured edit route is not evidence of equal provider cost.

The persisted record lives at `production_context.shared_foundation`, through the existing
owner-scoped `read`/`context` command adapter. It preserves the completed audio context.
The existing production-context schema is shared unchanged with preparation. A pending
reference-capacity conflict may be saved before analysis without claiming a completed
context; ordinary readiness persistence requires the full valid context.
Its plan hashes the full quote, normalized original brief/direction, job/owner/revision,
selected asset and explicit dependent IDs. Readiness requires inspected completed artwork,
owned retained image files, existing MIME/10 MiB validation and hashes of their actual bytes. The asset digest also includes
its attempt, provider receipts, outcome and file hashes; temporary signed file URLs do not
serve as file identity. JSONB object-key order does not change those digests.

Before any dependent work, the ready record saves each dependent's expected original
attempt. Retained dependent work without a matching durable binding is rejected before
new foundation generation; it is never relabeled or regenerated. Replay checks the saved
quote/direction, actual foundation bytes/asset identity and dependent attempt bindings.
Signed reference URLs may be refreshed only after that identity check.

`runPackFoundationBatch` completes/persists the selected foundation before admitting
ready dependent IDs through the unchanged bounded scheduler. Independent pending IDs
remain eligible if the foundation is absent, failed or uncertain. Preparation failure
and identity conflicts fail closed. Existing completed assets and receipts are preserved.
A selected artwork already running is not claimed again. This is single-admitted-run
composition, not a cross-workflow lease.

## Deferred settlement is an explicit owner continuation

The current settlement command terminalizes pending/running items and refunds the
remaining hold. This candidate therefore **does not call settlement** while declared
pending dependents are blocked or an existing asset is still running. It does not renew,
create or release a hold. The returned status/action includes the saved `hold_expires_at`
and does not present deferred work as pack success:

| Condition | Existing continuation |
| --- | --- |
| Foundation in flight with a recorded expiry | Read the same job; await/reconcile the already accepted attempt. No new claim. |
| Missing expiry or conflicting retained identity | Read and reconcile saved state; no indefinite waiting promise. |
| No artwork requested or quoted foundation missing | Read/reconcile the hold before revising unstarted work or creating a new pack. No silent foundation generation. |
| Existing references leave no room within the five-reference pack limit | Read/reconcile the hold, then explicitly choose reference scope for a new quote/pack. No input is silently dropped. |
| Confirmed failed foundation | Read the job, request a fresh per-asset estimate and explicitly approve a retry. No automatic paid retry. |
| Uncertain foundation | Read and reconcile; existing resume requires accepted request ID and saved route. Missing acceptance evidence requires manual reconciliation. |
| Completed but unusable/inconsistent foundation | Read and reconcile; this is not automatically a retry-eligible failed asset. |

Existing `read` reconciles an expired running hold using existing settlement logic.
There is **no cancel operation** in the current pack API. Running/funded brief edits are
rejected, and produced brief changes require a new pack. A per-asset retry quote or changed
revision does not automatically resume this candidate: it only accepts the original full
quote. These boundaries are explicit rather than new funding or refund policy.

Offline tests cover selection, missing/zero artwork, foundation and persistence barriers,
shared bindings, replay, retained receipt/attempt conflicts, lifecycle results, the existing
context adapter, and actual image-adapter input shape with mocked provider calls. They do
not prove database deployment, hosted Workflow delivery, provider quality, licensing or
cross-pack creative acceptance. Production remains unwired.
