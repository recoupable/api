# Video acquisition to original retention — CE15

This proposed server handoff belongs to [app#2131](https://github.com/recoupable/app/issues/2131). It defines the next producer boundary; it adds no executable adapter, authority table, public RPC, migration, provider call or release permission. Existing [API#1019](https://github.com/recoupable/api/pull/1019) and [Database#107](https://github.com/recoupable/database/pull/107) remain the video-locator intake. The evidence schema and projection stay in this directory; do not create another intake or ledger.

## Owners and existing interfaces

Context [app#2123](https://github.com/recoupable/app/issues/2123) owns authenticated payer/request attribution, approved pricing and ceilings, and the durable payer-partitioned admission, dispatch and cancellation journal behind [`ContextAccountingServices.transact`](../accounting/types.ts). Its [consumer](../accounting/runContextAccountingAttempt.ts) is currently fixture-only with injected services. A production journal/resolver is an existing owner deliverable, not a CE15 table to invent.

Reconciliation/shared accounting [app#2105](https://github.com/recoupable/app/issues/2105) owns wallet reservation composition. [Database#135 at e1a42e90](https://github.com/recoupable/database/pull/135/commits/e1a42e90f24256e0eda92b2bf5c2530c064f8c6f) supplies real durable held/settled/released reservation primitives and shared-hold protection. [API#1257 at c8828d93](https://github.com/recoupable/api/blob/c8828d93c0058b30f4f13aebacef1c00d06b2e39/lib/credits/reservations/README.md) documents their composition boundary. These primitives do not store Context policies, cancellation/dispatch ownership or provider-result provenance. Their existence does not supply the Context journal or establish hosted application.

CE15 owns acquisition identity and the raw-to-normalized video evidence mapping. Database owns atomic acceptance of original versions and a full snapshot. [Database#140's snapshot contract](https://github.com/recoupable/database/blob/c73e770fc6d69ce01ec6bddf08570fcbe77d99ae/proposals/context-retained-video-2131/CONTRACT.md) owns subsequent projection save/read, manifest, canonical JSONB fingerprint, lineage and locking rules. Reuse those rules by reference; its revoked proposal functions neither produce originals nor expose a production RPC.

## Phase order and authority

1. Resolve authenticated actor, owner, payer and the existing request/video/resource/accepted locator-link tuple from server records. Recheck current membership and locator lifecycle before dispatch. The owner supplies policy and canonical attempt identity; client fields, a reservation-shaped object or a callback cannot establish authority.
2. Use the existing Context accounting flow: fresh admission, newly held shared reservation, authorization recheck, then atomic competition between cancellation and dispatch intent in the owning journal. A reused hold is not permission to dispatch. Cancellation that wins before intent prevents dispatch and follows the existing release path.
3. The non-charging `dispatch` leaf performs one acquisition under that durable intent. Retention inside this leaf consumes prior dispatch authority plus a verified known acquisition outcome. It must **not require `completed` or `settled`**: the current runner records completion only after `dispatch` returns, then calls settlement/release. A retained snapshot/result identifier can support that return only when acceptance succeeded.
4. If cancellation arrives after intent, it cannot prove that no provider work happened. Recheck cancellation and authorization before acceptance. If cancelled or revoked, do not publish an accepted usable snapshot; record the known acquisition outcome for reconciliation through the owning journal. Private raw evidence needed for reconciliation follows its separately reviewed retention/access policy. Do not erase exposure or infer a refund from unusability.
5. A lost provider or retention reply leaves the same attempt unresolved. Resolve its recorded provider request/run and retention identity; never invoke a fresh acquisition as recovery. A lost settlement reply follows the existing exact settlement reconciliation path. Provider expense, customer charge and result usability remain separate facts.

The existing `dispatch(input)` port passes accounting identities, not authenticated video bindings or a retention authority token. The future server composition must resolve the exact dispatch record using those identities and bind it to the saved video request. Do not widen public input or treat a caller-supplied receipt as that resolver. Until this durable composition is reviewed, the flow remains disabled, including nominally free metadata acquisition.

## Proposed handoff: ContextVideoAcquisitionReceiptV1

This is a proposed internal record contract, not an exported TypeScript type or accepted public payload. The trusted adapter resolves and verifies every binding below; serialization and a matching hash do not authenticate its producer.

| Binding | Required evidence |
| --- | --- |
| Scope | Authenticated actor, owner and payer; existing request, video subject, resource and accepted locator-link IDs; canonical video ID. |
| Dispatch | Existing journal operation/attempt identity, pricing/policy version and ceilings, reservation reference, recorded dispatch intent, and current cancellation state. No parallel CE15 budget ledger. |
| Acquisition | Server-owned acquisition/idempotency identity; adapter name/version; exact provider request/run and dataset item or response identity; observed request/completion/retrieval times; exact raw-byte hash and private object/version reference if stored outside SQL. |
| Outcome | Known provider success/failure and available components; unsupported or unavailable reasons. An ambiguous response requires reconciliation and cannot create accepted evidence. |
| Mapping | Original source/version identities, raw-field attribution, supported media-version evidence, and normalized snapshot/version identity. Full snapshot content follows DB140, not reference-only wrappers. |

A webhook is a notification to resolve the pre-existing acquisition. Compare provider run, dataset/item, video and original-response bindings against the server record; reject substitution. Arbitrary dataset IDs, actor UUIDs, customer assertions and synthetic fixture receipts are not verified provider acquisition. Customer assertions retain their own evidence kind.

## Supported observations and unavailable outcomes

The initial scope is unresolved identity with metadata and genuinely timed captions. Preserve provider text, language and attribution; uploader/channel is not a credited artist, caption text is not original lyrics, and this contract establishes no recording ownership. Analysis remains unavailable unless separately acquired with its own evidenced ranges.

A supported media discriminator must identify the observed asset revision: for example, an immutable provider revision explicitly bound to the returned video and track, or a digest of the exact retained media asset. A URL, video ID, retrieval time, response hash or arbitrary `upload-1` string alone does not establish a media revision. Metadata and captions must be tied to the same evidenced revision; if that cannot be established, do not manufacture a DB140-compatible snapshot. Return `unsupported_media_binding` as a proposed acquisition outcome and keep raw reconciliation evidence separate from accepted projection evidence.

Available captions require actual provider timing, language/track identity and provenance back to the retained response and media revision. Plaintext-only captions cannot become timed segments. Mark captions unavailable with a reason when timing or provenance is absent; valid metadata can still produce a partial snapshot if its own required media binding is supported. Preserve unknown duration/variant honestly. No existing handle-oriented Apify scraper or recording-matching audio adapter is declared compatible by this document. A provider-format fixture and an evidenced discriminator must be selected before implementing its mapper.

## Database acceptance and retry boundary

The future Database producer accepts only verified server acquisition under the owning durable journal contract. No SQL signature or authority table is specified here. Before writing, it must lock and recheck current membership, request, resource, video subject and accepted locator link using DB140's order, then verify exact acquisition/owner/request/video/media bindings. A previously authorized read is insufficient; removed, rejected, cancelled or changed bindings must refuse acceptance.

Cancellation and acceptance need a concrete serialization point in that implementation. If the owning journal is in the same database, its cancellation/dispatch row must participate in the documented transaction/lock order. If it is elsewhere, the owner must provide and qualify a durable acceptance claim/fence protocol with explicit failure and reconciliation states before implementation is accepted. Separate HTTP reads cannot promise atomic cancellation or a cross-store rollback. This document does not assert either storage topology exists.

Within the database transaction, persist the original source/version rows, full snapshot and durable retention identity together. Allocate snapshot UUID before self-inclusion and use DB140's canonical JSONB fingerprint convention. An exception rolls back all of these database writes. An external raw-object upload is not part of that rollback: failed acceptance leaves an unaccepted object tracked for policy-governed reconciliation/cleanup, never a usable source by implication.

Serialize the acquisition's stable retention key. Exact replay after a lost commit reply returns the same original/snapshot IDs only after current authorization, locator, cancellation and source-lifecycle checks; changed payload or bindings conflict. Retry cannot insert wrapper versions, bypass withdrawal/removal, or dispatch a provider. No accepted snapshot is returned when the acquisition outcome is unknown. A known paid-but-unusable outcome remains accountable without inventing a refund or zero provider expense.

## Next implementation handoff and qualification

Before starting another candidate, inspect the existing Context accounting work and [API#1017 cancellation candidate](https://github.com/recoupable/api/pull/1017), plus shared reservation ownership. Continue app#2123's durable journal/dispatch/cancellation composition with Database#135 primitives; CE15 must not create a replacement ledger. CE15 then supplies a captured provider-format mapper and the reviewed Database original-retention transaction. Only afterward compose DB140 projection, a thin authorized storage reader, and the existing preparation seam. Keep planner/brief registration and release separate.

Qualification must run a disposable durable acquisition-record → original retention → DB140 load/save/read round trip. Prove: callback/run substitution rejection; current membership and locator revocation races; cancellation winning before dispatch and before acceptance; cancellation after dispatch retaining exposure; unknown outcome reconciliation; exact replay after lost commit response; changed-payload conflict; transaction rollback without orphan database versions; raw-object cleanup accounting; withdrawal/removal refusal; supported media revision and real timing; metadata preserved when captions are unavailable. Require exact SQLSTATE on database denials, not connection/executor errors. Label captured inputs synthetic qualification evidence, never live acquisition.

Source baseline: API `d551fce2c72f8af28aaf356cbe98bb6dfb2789d4`, DB140 `c73e770fc6d69ce01ec6bddf08570fcbe77d99ae`, and the reservation pins above. This contract delivers ownership, ordering and acceptance requirements only. Production journal/resolver, provider mapping, Database producer, release grants, approved spend and intended-account runtime proof are separate implementation/release outcomes.
