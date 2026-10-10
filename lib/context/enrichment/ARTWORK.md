# Release artwork branding (`artwork-branding-v2`)

`collectContextArtwork` extracts one release's visual language into an `artwork_branding` document on the **release subject**, through the normal claim → call → complete/fail lifecycle in `runContextEnrichment`. It is a neutral visual source for later features (CE14 brief selection, Sites direction); it does not propose a website, campaign, game or fan experience. The only proposals it keeps are neutral design choices grounded in visible evidence, in their own `proposedDesignChoices` field. Part of recoupable/app#2128.

## Contract

`artworkBrandingSchema.ts` is the persisted content shape:

| Field                   | Kind           | Notes                                                                                 |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------- |
| `scope`                 | marker         | Always `"release"`. Set by the server after the model call, never asked of the model. |
| `visibleObservations`   | observation    | What is directly present in the image. Proposal language is rejected here.            |
| `palette`               | observation    | `{ color, role }` pairs. Palette alone never counts as a visual document.             |
| `typography`            | observation    | Lettering as seen, not a typeface claim.                                              |
| `composition`           | observation    |                                                                                       |
| `texturesAndMaterials`  | observation    |                                                                                       |
| `motifs`                | observation    |                                                                                       |
| `visualInterpretation`  | interpretation | Inferred idiom or mood, kept apart from observations.                                 |
| `proposedDesignChoices` | proposal       | Explicitly labelled; may be empty. Never evidence.                                    |
| `uncertainties`         | gap            | What the image cannot settle.                                                         |

The module input records `scope: "release"`, `releaseSubjectId`, the exact https `artworkUrl`, the `assetVersion` and the system prompt (`ARTWORK_PROMPT` plus a v2 supplement in `collectContextArtwork.ts` that asks for `proposedDesignChoices`, so the prompt and the structured-output schema agree), so the reuse fingerprint changes whenever the asset, prompt or release changes. The module `sources` entry is the artwork URL with its asset version. Two releases of the same recording (original and reissue) therefore produce two release-scoped documents; nothing here writes to an artist subject, an enduring artist brand or an era document (CE16 owns those).

## Validation guards (`validateArtworkBranding.ts`)

Deterministic checks run on the parsed content inside the runner's `call`, before `complete_context_enrichment`, so a rejected output is never saved:

- **Accent colours only**: typography, composition, textures and motifs all empty or placeholders (`n/a`, `none`, `unknown`, `-`) → `Artwork evidence is limited to accent colors`.
- **Too thin**: fewer than three non-placeholder visible observations → `Artwork evidence needs at least three visible observations`.
- **Invented authority**: an assertive field (observations, palette, typography, composition, textures, motifs, interpretation, proposals) asserting artist intent/endorsement/approval, an official brand guide/rules/book, brand guidelines, or a game concept → `Artwork evidence claims artist intent or endorsement`. `uncertainties` is not checked, quoted lettering from the image is ignored, and a sentence that negates or hedges before the match ("No brand guidelines are visible", "unclear whether the artist intended…") is accepted.
- **Proposal in evidence**: `should` / `recommend` / `we propose` / `proposal` outside quoted lettering inside `visibleObservations` → `Artwork evidence mixes a proposal into visible observations`. Proposals belong in `proposedDesignChoices`.

These are evidence-shape checks, not a judgement of artistic quality, and they do not make a live extraction correct. They are regexes: a negation or quotation can hide a real claim, and live false-positive rates are unmeasured.

### What a rejection does today (not recoverable without reconciliation)

A guard or model-check rejection throws after the paid call. `runContextEnrichment` then calls `fail_context_enrichment`, which on the current database marks the attempt `status = 'unknown'` with a generic "inspect the provider trace and reconcile" error. Consequences, all unchanged by this slice:

- The rejection reason (`Selected artwork model unavailable: …`, `accent colors`, …), the provider trace and the call's cost are **not persisted**; only `complete_context_enrichment` saves a result, and `runContextEnrichmentPlan` records the node as `failed` without the message. The reason reaches only the direct caller as the thrown error.
- `claim_context_enrichment` returns `state: 'unknown'` for any earlier attempt with the same fingerprint, so re-running the same release, asset, prompt and model raises `ContextNodeNeedsReconciliation` until an operator reconciles the attempt. A changed asset, prompt or key is a new fingerprint.

Making a deterministic rejection a recorded, retryable `failed` attempt with its reason and trace needs a database change to `fail_context_enrichment`; it is out of scope here.

## Missing or unreadable artwork (`resolveArtworkBrandingInput.ts`)

The resolver is pure scaffolding for callers that hold the saved `release_metadata` artwork list (the `artwork: [{ url, width?, height? }]` shape saved by `fetchSpotifyContext`; the current fetcher keeps only `url`). It never throws and never calls a provider:

- `status: "available"` with the largest https image (explicit dimensions win; otherwise the first entry, which Spotify lists largest-first) and `assetVersion` = SHA-256 of the exact URL plus known dimensions. Image bytes are not hashed, so a replaced image at an unchanged URL is not a new version.
- `status: "missing"` with `gap: { topic: "artwork_branding", subjectId, reason, fallback: "release_metadata" }` where `reason` is `no_artwork_in_release_metadata` or `unsupported_artwork_url` (non-https).

**Not connected:** nothing in production calls the resolver yet, and the gap object is neither persisted nor surfaced. `collectContextArtwork` itself still rejects a missing or non-https URL with a validation error before any claim or provider call. Separately, the creative-direction brief already lists `artwork_branding` in `missingTopics` whenever no saved artwork document exists for the request's subjects (existing `compileContextBrief` behaviour); the gap `reason` does not reach it.

Unreadable image bytes (a fetchable URL that the vision model cannot interpret) are not detected locally; they surface as a provider-call failure with the consequences above.

## Model substitution

The module requests `openai/gpt-6-astra` through the AI Gateway with `maxRetries: 0` and no `providerOptions.gateway.models` fallback list, so the gateway is not asked to fall back to another model; an unavailable model fails the call.

As a further check, `generateContextObject` records `trace.reportedModel`: the `response.modelId` inside the gateway's raw response body (`response.body`), or `null` when the body reports none. It does not use the SDK's top-level `response.modelId`, because with the gateway that field echoes the requested id. `collectContextArtwork` rejects a reported model other than `gpt-6-astra` (with or without the `openai/` prefix, or as a dated snapshot such as `gpt-6-astra-2026-09-01`) with `Selected artwork model unavailable: <reported>`, so that output is never saved. A `null` report cannot reveal a substitution. Whether the live gateway body carries `response.modelId`, and in which spelling, is unverified.

## Honest state

- Implemented and fixture-tested (`__tests__/artworkBranding.test.ts`, `__tests__/generateContextObject.test.ts`, `__tests__/collectionModules.test.ts`): contrasting fixtures, accent-only and placeholder rejection, endorsement/proposal rejection with hedge, negation and quotation handling, model check against a fake gateway response (real `ai` SDK, fake `fetch`, no network), missing-artwork gap, two-release separation, and a brief that lists artwork as missing until a saved artwork document exists.
- Not connected: no planner module id or dispatcher entry runs this automatically, and the resolver has no production caller; live vision calls are gated on CE07 (#2123) spending authority and release evidence from CE10 (#2126).
- Not recoverable: rejections leave an `unknown` attempt that needs reconciliation (see above).
- Not deployed or live-verified: the only live artwork extraction so far was one manual run in the approved paid pilot (`enrichment.live.test.ts`) against `artwork-branding-v1`. `artwork-branding-v2` has not been exercised against the gateway, so the live body's model report and the validator's false-positive rate on live output are unconfirmed.
- `ARTWORK_PROMPT` in `prompts.ts` is unchanged; the v2 supplement lives in `collectContextArtwork.ts`.
