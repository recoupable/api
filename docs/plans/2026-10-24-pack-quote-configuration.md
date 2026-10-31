# Bind Release Pack approval to supported production configuration

Bounded source/mock successor for app#2266 under app#2254; depends on API#1135
accepted-provider receipt preservation. No models, numeric rates, capability choices,
provider licensing decisions, spending or production activation change here.

## Adopted integrity contract

Persist a server-owned snapshot and digest of existing model routes, pack settings,
customer rate inputs and adapter/pricing versions in quote JSON. Include the digest
in the quote fingerprint. JSONB object key ordering must not change identity.
Before initial approval or a fresh failed-asset retry reserves credits, require the
exact supported configuration. Missing legacy or incompatible snapshots require a
new estimate and approval. Recheck before each unstarted production stage, including
audio analysis, so a deployment between approval and execution cannot silently
substitute current configuration.

Accepted fal requests are exceptions only for receipt polling: use the saved route,
never submit again. Their recovery does not authorize new slides, motion, captions,
composition or inspection under an unsupported quote. Missing original route stops
before resume reservation; completed saved outputs remain reusable. Existing atomic
reservation/settlement and uncertain-attempt behavior remain the persistence owner.

## Implementation and bounds

One server configuration builder reads existing routes/rates and shared pack settings.
Current implementation supports only an exact matching snapshot, not a historical
configuration catalog. Execution can use current settings only after equality is
established. The adapter version must change when prompt/recipe/adapter semantics
change; route aliases do not prove immutable provider weights or provider-side
behavior. Account capability availability still uses existing readiness checks.
The audio endpoint identifies its configured route, not authorization or model weights.

No database schema migration is needed for the existing quote JSON. This does not
complete capability routing, commercial analysis suitability, provider cost measurement,
concept budgets or atomic multi-stage budget improvements. All provider behavior in
new tests is mocked. Original customer amounts and model choices are preserved.
