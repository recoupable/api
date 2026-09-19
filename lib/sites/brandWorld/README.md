# Artwork → brand world → working site

`generateSite` is shared by UI, HTTP and MCP. It now makes two bounded model calls:

1. `generateBrandWorld` reads all supplied images and the brief, validates structured output and source references, and returns a versioned creative specification.
2. `generateSite` gives that specification, original assets and the previous design to the implementation model. It validates the design and parses JavaScript before returning a replacement draft.

Both use `SITES_MODEL` (default `openai/gpt-6-astra`) with no SDK retries. Either failure leaves persistence to the existing operation boundary: no replacement draft is returned, and compare-and-swap still protects concurrent edits. There is no new automatic publish step or generation timeout. Two calls increase latency and token use; hosting limits remain. The existing billing work in #2105 must account for both calls before paid release.

## Modules

- `artworkGuidance`: visible evidence vs interpretation, source identity, uncertainty and no-art fallback.
- `worldGuidance`: composition, visual vocabulary, role-based colors, typography, state design and revision preservation. It is not a style preset.
- `qualityGuidance`: hierarchy, restraint, mobile fit, accessible controls and the cover-hidden test. Shared by planning and implementation.
- `implementationGuidance`: runtime capabilities, actual game/website behavior, trusted Widget boundaries and executable output contract.
- `schema`: inspectable decisions with bounded fields; required nullable source indices work with strict model output schemas.

`draft.brandWorld` retains version, model, source assets and specification. Existing drafts without metadata still work. Revisions receive the previous world, current assets and latest instruction; small changes should preserve unaffected identity. Public snapshots omit the internal specification because it may contain customer instructions. No database migration is needed: existing draft/published JSON stores the optional metadata.

## Asset capability boundary

The planner names each needed asset and chooses supplied, procedural or defer. Supplied references must exist. Procedural work means graphics the current HTML/CSS/canvas/SVG generator can actually produce. Defer records a need and a usable fallback, not a queued asset job or permission to invent a file. Adding an image-production stage later should materialize approved assets before implementation and replace deferred entries with real validated sources.

Complex artwork is not made better by more CSS instructions. A plan should simplify honestly when finished art is missing. The system must not quietly turn a photographic cover into a cartoon, or a typographic cover into a generic dashboard.

## Review matrix

Use this matrix when evaluating prompt/model revisions. Do not treat a schema pass as an aesthetic pass. Keep screenshots and judgments tied to the generated revision and source artwork.

| Source / request | Expected transformation | Failure signal |
| --- | --- | --- |
| Restrained photographic cover | Composition, light, crop, tonal rhythm inform the site | Unrelated illustration or ornamental cards |
| Detailed illustrated cover | Source-specific silhouettes/materials; honest asset fallback | Rough replacement mascots or a mandatory cartoon template |
| Typography-led cover | Type hierarchy, proportion, rhythm and spatial composition | Unreadable CSS imitation of custom lettering |
| Abstract / texture-led cover | Repeated visual rules, scale and motion with a purpose | Color sampling plus a generic hero |
| No artwork, clear brief | Explicit brief-only direction | Claims to have observed nonexistent art |
| Conflicting reference / explicit override | Customer preference recorded; source roles remain distinct | Ignoring the override or inventing artist brand rules |
| Small revision | Existing world and unaffected behavior retained | Full visual redesign for a button/text change |
| Mobile, long title, short viewport | Primary action and controls remain reachable | Start overlay clipped inside a fixed-height stage |

Ask: with the cover hidden, what specific source-derived signatures remain? Are the assets finished enough for the chosen direction? Does the first view explain the activity without art-direction copy? Do completion, error and player states belong to the same world?

Current review is prompt self-review. Automated rendered screenshot critique, asset generation and a visual-quality benchmark are not implemented by this module. Manual preview inspection remains necessary; #2094 tracks the broader loop.
