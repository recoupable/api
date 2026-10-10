# Release artwork branding (`artwork-branding-v2`)

`collectContextArtwork` extracts one release's visual language into an `artwork_branding` document on the **release subject**, through the normal claim → call → complete/fail lifecycle in `runContextEnrichment`. It is a neutral visual source for later features (CE14 brief selection, Sites direction); it does not propose a website, campaign, game or fan experience. Part of recoupable/app#2128.

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

The module input records `scope: "release"`, `releaseSubjectId`, the exact https `artworkUrl`, the `assetVersion` and the system prompt, so the reuse fingerprint changes whenever the asset, prompt or release changes. The module `sources` entry is the artwork URL with its asset version. Two releases of the same recording (original and reissue) therefore produce two release-scoped documents; nothing here writes to an artist subject, an enduring artist brand or an era document (CE16 owns those).

## Validation guards (`validateArtworkBranding.ts`)

Deterministic checks run on the parsed content before `complete_context_enrichment`. A rejection throws inside the runner's `call`, so `fail_context_enrichment` records a visible, retryable failed attempt and nothing is saved:

- **Accent colours only**: typography, composition, textures and motifs all empty → `Artwork evidence is limited to accent colors`.
- **Too thin**: fewer than three non-empty visible observations → `Artwork evidence needs at least three visible observations`.
- **Invented authority**: any string matching artist intent/endorsement/approval, official brand guide/rules/book, brand guidelines, or a game concept → `Artwork evidence claims artist intent or endorsement`.
- **Proposal in evidence**: `should` / `recommend` / `we propose` / `proposal` inside `visibleObservations` → `Artwork evidence mixes a proposal into visible observations`. Proposals belong in `proposedDesignChoices`.

These are evidence-shape checks, not a judgement of artistic quality, and they do not make a live extraction correct.

## Missing or unreadable artwork (`resolveArtworkBrandingInput.ts`)

Callers resolve the saved `release_metadata` artwork list (the `artwork: [{ url, width?, height? }]` shape saved by `fetchSpotifyContext`; the current fetcher keeps only `url`) before any claim. The resolver is pure and never throws:

- `status: "available"` with the largest https image (explicit dimensions win; otherwise the first entry, which Spotify lists largest-first) and `assetVersion` = SHA-256 of the exact URL plus known dimensions.
- `status: "missing"` with `gap: { topic: "artwork_branding", subjectId, reason, fallback: "release_metadata" }` where `reason` is `no_artwork_in_release_metadata` or `unsupported_artwork_url` (non-https). No provider call and no claim happen for a gap; the creative-direction brief then lists `artwork_branding` in `missingTopics`, which is how extraction stays ahead of selection.

Unreadable image bytes (a fetchable URL that the vision model cannot interpret) are not detected locally; they surface as a failed attempt from the provider call and remain a gap in the brief.

## No silent model substitution

The module requests `openai/gpt-6-astra` through the AI Gateway. `generateContextObject` now records `trace.actualModel` from the gateway response (`response.modelId`, or `null` when absent). `collectContextArtwork` rejects any present `actualModel` other than `openai/gpt-6-astra` or its provider-less spelling `gpt-6-astra` with `Selected artwork model unavailable: <actual>`, so a substituted answer is never saved and the failure is visible in the attempt record. An absent `actualModel` (older traces, fixtures) is not treated as a substitution.

## Honest state

- Implemented and fixture-tested (`__tests__/artworkBranding.test.ts`, `__tests__/collectionModules.test.ts`): contrasting fixtures, accent-only rejection, endorsement/proposal rejection, model guard, missing-artwork gap, two-release separation, brief missing-topic assertion.
- Not connected: no planner module id or dispatcher entry runs this automatically; live vision calls are gated on CE07 (#2123) spending authority and release evidence from CE10 (#2126).
- Not deployed or live-verified: the only live artwork extraction so far was one manual run in the approved paid pilot (`enrichment.live.test.ts`) against `artwork-branding-v1`. `artwork-branding-v2` has not been exercised against the gateway, so the real `modelId` spelling and the validator's false-positive rate on live output are unconfirmed.
- The prompt (`prompts.ts` `ARTWORK_PROMPT`) is unchanged in this slice; the new `proposedDesignChoices` field is requested through the structured-output schema.
