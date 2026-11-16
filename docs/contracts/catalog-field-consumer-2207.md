# 2207 retained field read and one-metric consumer contract

Status: **design delta for root and UI review**, October 27, 2026. No route, executable schema, SQL wrapper or App implementation is added. Names below specify one concrete proposed consumer contract; they are not currently accepted inputs.

## Exact existing consumer and required delta

Inspected API `959d30bf19f28ae6a8c75031f424831923403374`, App `1c4cc8b0cc3993862bdc892fc9908163d10e35a1`, and Database130 `ed9e805369f1a9ca52174928b5b3b9c24d9508be` (merged `5e41ab186ea43532fdb42970fd49ffcfea7e685d`). Database130's 53 tests per PG15/17 qualify computation only while the authority transaction is held.

The consumed development path is `validateChatWorkflow` → `runAgentWorkflow` → `prepareCatalogSurfaceStep` → `prepareCatalogSurface` → `sendCatalogSurfaceStep` → assistant-message persistence. Current preparation calls `getCatalogStreams`, then creates a distribution snapshot and raw-lineage fingerprint. Its request admits workspace/report query only. Neither raw observation hashes nor ISRCs are accepted Context request/result/source-version UUIDs.

App `descriptorSchema` and `collectionResultSchema` are strict; neither admits the full field binding. `toCollectionComponent` serializes display cells, not authority. `indexDescriptors` can already handle one descriptor per unchanged ObjectRef.

Proposed change at this path: make the development request a strict union retaining the existing report branch and adding a discriminated `mode: "retained_field"` branch below. Preparation dispatches this branch to a real authorized field read, then returns a bounded collection with its explicit field companion. Delivery and history must preserve and validate that companion. Do not call `getCatalogStreams` to manufacture the missing accepted-result selection or silently fall back to it when the exact field read fails. UI owns the App schema/transport delta and consumer; Context owns selection/currentness and authority contract. Existing report behavior is unchanged until the new branch is adopted and implemented.

## Selection: exact, untrusted input

The new branch is exactly:

```ts
{
  mode: "retained_field",
  workspaceId: UUID,
  catalogId: UUID,
  field: "current_streams",
  query: { since: ISODate, days: Integer1To366, timezone: "UTC" },
  method: {
    recipe: "catalog-retained-stream-fields/1",
    recipeHash: SHA256,
    evaluatorSha256: SHA256,
    helperSha256: SHA256
  },
  selections: [{
    ownerId: UUID, requestId: UUID, subjectId: UUID, catalogId: UUID,
    resultId: UUID, revision: NonnegativeSafeInteger,
    topic: "catalog_retained_streams", sourceVersionIds: [UUID]
  }]
}
```

All objects strict; UUIDs canonical; SHA256 lowercase 64 hex. `selections` has 1..8 entries and no duplicate subject, even with different versions. Every owner equals workspaceId and every catalog equals catalogId. Exactly one source version per entry. `revision` is the Context document revision, never a surface/working revision. `since` is current-period start, not the beginning of the two-period evidence range. No pagination or implicit latest-result lookup. Eight bounds the initial selected set, not the catalog population; this branch does not advertise full-catalog totals.

Method is an exact server-registered pin, not client-selectable executable code:

- recipe hash: `65a06a785aa496e1232fe3a9f1606595f19c1a152b710ca30c4c06612f01864a`
- evaluator hash: `163563e15dd92d473aa51899c54c96300f20d27072b83e39ffb01c84f3adc64e`
- helper hash: `91dcca66c8dec0851c1f6e110257a63b730e9b7ae33a60bceb0e9ffcf318dd81`
- audited source: API `6ba799dbb67be284adcd6f8bcd8fcde2faa6c2b8`, merged `c5dfa7c4a3c50b8daabf8d3b7d11a53b118582ee`.

No actor/account credential, boundary state, evidence envelope, computed amount, label, asOf or authority assertion is accepted in this branch. Selection must come from an authorized accepted-result receipt/read, not from catalog display rows. That receipt-to-host selection source is still absent at the current callsite.

## Internal read and bounded response

Server input adds authenticated actor and session/chat/assistant anchor outside the client object. `validateChatWorkflow` currently derives accountId through `validateAuthContext(request)` without an account override. Preserve that actual actor; independently authorize selected workspace and every exact binding. Never substitute ownerId, workspaceId or a fixture actor for a denied caller.

For each entry, actual read must verify owner/request/expanded membership/recording/ catalog/result/current document revision/exact immutable source version and current retained tuple provenance, then run the pinned evaluator while the same transaction holds the required locks. For multiple entries acquire locks in a stable reviewed order; do not infer cross-row atomicity from eight independent successful reads. `asOf` is a server-captured finite timestamp used by the evaluator, not provider freshness. An undeployed private SQL function is not an RPC transport.

All-or-nothing initial batch: if any entry is unavailable, mismatched, superseded, withdrawn or unauthorized, return `{state:"unavailable"}` with no amounts, labels, new versions, binding echo or per-object existence diagnostics. Operational failure returns `{state:"error"}`; invalid shape/method/size returns `{state:"invalid"}`. Do not return old values alongside a refusal. Domain errors are not new public HTTP status mappings in this proposal. Null/absent _measurements in qualified evidence_ are ready-but-unknown, not access failure.

A successful internal result is exactly:

```ts
{
  state: "ready",
  contract: "catalog-retained-field-projection/1",
  workspaceId: UUID, catalogId: UUID,
  field: "current_streams",
  method: { recipe, recipeHash, evaluatorSha256, helperSha256 },
  query: { since, days, timezone: "UTC" },
  asOf: ISOOffsetTimestamp,
  semantics: "historical_snapshot",
  items: [{
    ref: {workspaceId, authority:"context", kind:"recording", id:subjectId,
          sourceVersionIds:[UUID]},
    binding: {ownerId, requestId, subjectId, catalogId, resultId, revision,
              topic:"catalog_retained_streams", sourceVersionIds:[UUID]},
    value: {state:"known", amount:NonnegativeSafeInteger} | {state:"unknown"},
    periods: {previous:{start,end_exclusive}, current:{start,end_exclusive},
              days, timezone:"UTC"},
    coverage: {comparisonState:"comparable"|"incomplete",
               absentDateCount, nullDateCount, missingDateCount},
    source: {provider:"luminate", metric:"daily_streams", platform:"all_dsps",
             territory:"worldwide", timezone:"UTC",
             retrievalRange:{earliest:ISOOffsetTimestamp,latest:ISOOffsetTimestamp}}
  }]
}
```

Ready items have the same cardinality/order as selections, max8; ref and binding must agree exactly with the requested identities. Query/method are shared and exact; each item's periods must reconstruct from query. Coverage counts are integers0..732, computed from evaluator's arrays; comparison state matches known/unknown semantics. For current_streams, known requires comparable; incomplete yields unknown. Keep raw binary64 rules for future percentage fields separate: they are not admitted here. Return only the selected field. The initial contract has no per-row title authority; use subject UUID as the descriptor label until authorized names get a separate source. Do not substitute a possibly differently scoped catalog row name.

The entire normalized UTF-8 JSON response is <=32KiB, reject excess, never truncate. No observation tuples, date arrays, provider recording ID, source URL, raw evidence or access token is returned. Full evidence remains behind a separately authorized source read. Retained retrieval timestamps mean retrieval, not provider update time.

## One-metric projection and companion ownership

Proposed transport addition for UI review: a typed optional `fieldContext` on the complete source snapshot, required for this new branch. Its value is the bounded ready response above **without `state`**. Keep each item's typed `value` in this immutable companion: the current collection renderer serializes values into display strings and does not persist descriptors. This companion is the canonical typed source for descriptor reconstruction, selection and text; validate that rendered collection/text projections agree with it. Never parse an amount from a display string. It remains immutable source context, not saved controls.

Strict snapshot parsing must explicitly admit it on producer and consumer; unknown-key passthrough, JSON in labels and side channels are forbidden. Schema/version compatibility must be explicitly negotiated by UI before routing; this proposal does not assume current schema-v1 clients accept the addition.

Projection is deterministic and one-to-one, before `indexDescriptors`:

| Descriptor field | Mapping |
| --- | --- |
| ref | Unchanged exact response ref; same UUID and single version |
| label | subject UUID, bounded and nonempty |
| field.value | known amount including0; unknown has no amount key |
| role | `observed`, meaning derived from retained observations, not hypothetical |
| metric / unit / currency | `current_streams` / `streams` / null |
| periodStart / periodEnd | Current start / current end_exclusive minus one UTC day |
| territory | `worldwide` |
| basis | `Computed sum of retained Luminate daily streams; retrieval time is not provider freshness.` |
| observedAt | source.retrievalRange.latest, with retrieval meaning stated in basis/text |

Both original half-open periods remain exact in fieldContext. No four-field expansion and no per-field object IDs. A later metric choice requires a new exact read/projection contract; it cannot relabel the existing current_streams amount. Selection is max8 original ObjectRefs; joining selection to fieldContext uses the full ObjectRef, then validates full binding/query/field/method, never id alone.

Collection `aggregationScope="page"`, `completeness="partial"`, `knownTotal=null`, `hasMore=false`, `nextCursor=null`, population=`Selected recordings; catalog total unknown`. This is an explicit selection, not catalog pagination. It makes no full-population or additive-metric claim. Source snapshot/text must say historical retained values; readable text uses the same values and unknown states as the collection.

Validate the complete actual outbound data part after labels/text/companion are assembled: <=256KiB UTF-8, without truncation. The 32KiB response cap does not replace that check. Controls remain <=64KiB and commands <=128KiB. Controls may hold selected refs and allowlisted display/filter choices, never this companion, provenance, amounts or copied evidence. Server reconstructs exact field context from the source snapshot for a later action; the controls do not attest authority.

## Publication, replay and withdrawal boundary

A ready result certifies only that computation was authorized during its held read. Once locks release it is a historical snapshot, **not a currentness lease**. A fresh read/action reauthorizes exact binding and method; correction or withdrawal must refuse the stale binding rather than upgrade to a newer result or retain old amount. Downloaded historical observations cannot be retroactively undisclosed.

Current preparation is journaled separately from delivery, and replay reuses it. Do not route retained-field output through that path unchanged: it could replay withdrawn data. Before each initial delivery/replay/persistence, the owning enrolled source-publication protocol must recheck the exact prepared binding and permission, then preserve the immutable prepared bytes. No recomputation under the same surface revision; changed binding requires explicit new preparation/new assistant identity. A pre-send recheck still does not guarantee that revocation cannot commit before network delivery. No current-at-display claim is allowed. Any stronger atomic publication claim requires the separately reviewed source/persistence boundary.

History, reconnect, text, export and model reads must perform current authorization and withhold unavailable fieldContext **and its numeric/text projections together**. The current raw history route does not do this for embedded source content. Therefore this new branch stays disabled until that path is integrated; a development flag alone does not solve replay/history disclosure. No unused wrapper is an acceptable substitute for these missing consumers.

## Concrete implementation gates and acceptance

1. **Selection origin:** supply actual authorized accepted-result identities to the host; current catalog row/report query cannot do so. Reject synthetic/guessed IDs.
2. **Actor and callable authority:** preserve actual credential actor, authorize session/chat/workspace, implement reviewed Supabase-only exposure for deployed read/retention functions. Current proposal functions are private/default-denied; no migration, grant or live `.rpc()` is authorized by this document.
3. **Source family enforcement:** all writers of the reserved retained locator/topic, source versions/results/documents and retained observations must honor the lock/ immutability/currentness rules. Generic metadata/enrichment/direct service writes are outside the53-test supported-mutator proof; inventory and close those routes before claiming production enforcement. Root owns apply/grants/rollback gates.
4. **UI-owned schema:** adopt fieldContext with explicit producer/consumer capability, then test actual preparation→delivery→App parsing→selection→text, including full binding round-trip and all byte caps. No schema edits are included here.
5. **Publication/history:** integrate the exact source check with enrolled persistence and every disclosure path; test withdrawal between preparation/delivery and before replay/history/export. No fallback to cached numeric text on unavailable/error.

Required consumer assertions, once gates allow implementation: exactly one descriptor per unchanged ref; zero versus unknown; both periods retained; full binding and method mismatch refusal; result revision independent of surface/working revision; no evidence in controls; complete part byte refusal; stale response cannot overwrite a newer scope; actual credential actor denial does not retry as owner; withdrawn source withholds all numeric/text projections. These supplement, not repeat, the adopted53 offline tests.

Concrete source-inspection anchors for gate3: `save_context_metadata` in Database `supabase/migrations/20260920040000_context_guests.sql` accepts supplied URL/topic; `complete_context_enrichment` in `20260923070000_context_enrichment_scope.sql` writes supplied source items and accepts results. These are starting points for reserved-family guards, not an exhaustive writer/grant audit. At this API pin, no `read_binding`, `reconcile_retention` or `stream_binding_proposal` call exists under `app/` or `lib/`. Gate5's actual raw-history consumer is `lib/sessions/chats/getSessionChatHandler.ts`, which selects saved message parts following session/chat authorization without the proposed per-field source check.

Next action: root/UI review this exact contract and schema ownership. Runtime work is blocked by selection origin, callable deployed authority and publication/history gates; document approval alone does not unblock a live implementation.
