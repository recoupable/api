# Release-to-experience production

UI, HTTP and MCP use the same production stages. A Spotify URL is sufficient; a customer prompt is optional.

1. Resolve the release and artwork. Track metadata can supply an official preview.
2. Collect sourced artist research and analyze available audio through existing Recoup services. Missing evidence is recorded explicitly; previews are not full-song analysis.
3. Choose among distinct concepts with a specific release connection, credible fan motivation, concrete payoff and executable journey. An independent concept review rejects arbitrary or unsupported ideas before asset spending. Failure stops the job; no automatic paid brainstorming loop.
4. Produce up to two finished images with the existing image service and store normalized assets in the workspace.
5. Pass context and real asset URLs through the reusable brand-world and implementation modules.
6. Render mobile and desktop in an isolated Vercel Sandbox. Execute the complete structured journey using accessible controls, verify expected visible outcomes, capture initial/final states, runtime errors and horizontal overflow. Reopen downloaded/shared image bytes in a separate page, reject blank/invalid outputs and include the actual artifact in visual review.
7. Critique screenshots. Route one revision to direction, assets or implementation, then review again.
8. Save a private draft with evidence and reviews. Persistent issues are marked needs-review. Publishing remains a separate customer action.

## Execution and billing

Default generation starts a durable workflow in `app/workflows/sites`; `get_site_generation` polls an account/site-bound signed token. The editor remembers the token for refresh recovery. An expected-revision claim prevents two requests with the same revision from starting duplicate work. Final save checks access and revision again. Failed stages do not overwrite the draft or automatically retry billable work. Completed workflow stages are reusable on resume.

Models use SITES_MODEL (default openai/gpt-6-astra). Token calls use chat credit accounting; research, music analysis and generated images use existing service credit paths. Credit checks occur before paid stages. There is no aggregate reservation protecting against simultaneous jobs, and sandbox hosting costs are not yet separately metered. Maximum image count is four across initial production and one revision.

SITES_JOB_SECRET can provide a dedicated job-signing key; otherwise SUPABASE_KEY is used. Tokens expire after seven days and do not replace normal API/workspace authentication. Rotating the signing key invalidates outstanding poll tokens.

## Limits

No full-track Spotify/YouTube download resolver. Audio analysis requires the existing Music Flamingo service credentials. Albums/playlists currently receive basic metadata rather than per-track audio analysis. Research is sourced search evidence, not verified biography. Rendering checks the planned generated-experience journey, not Spotify authentication, every game branch, or real native OS sharing. Native sharing is intercepted to validate the actual image File payload. Missing or failed journeys force needs-review even if the visual critic says pass. Verification evidence and limitations are stored with each review. The trusted login/player components retain their existing theme contract. Screenshot review is bounded feedback, not a guarantee of artist approval.

Run focused tests with `pnpm exec vitest run lib/sites/__tests__`. The isolated-browser smoke test is opt-in via SITES_RENDER_LIVE_TEST=1 and incurs a sandbox run.

## Capability contract

`experienceContract.ts` is the shared production capability registry. The director and builder receive the same limits. Supported: local browser interactions, production-time image assets, real image exports, and native image-file sharing with a download fallback. Visitor-time AI image/video/music generation, hosted personalized result URLs, and server-backed scores are not wired into the generated runtime and must not be promised. Add a capability only alongside its working runtime implementation and journey verification. No model-written test code is executed: the runner supports bounded click, fill, keypress, download and share actions.

The concept gate assesses release relevance, fan value, feasibility and journey completeness; this is a fallible model judgment, not proof of artistic value. Screenshot review also judges the actual exported artifact. A reviewed result establishes only the recorded test scope, never artist endorsement.

## Saved Context Engine handoff

Pass `contextBriefId` to the HTTP generate action or MCP `generate_site`. Save a `creative_direction` brief through `/api/context` first. Sites reads the snapshot server-side in the site's workspace, matches its Spotify track, and forwards accepted evidence with document/result/source versions, coverage and missing topics to the director, independent concept review, brand-world planner and implementation generator. Both direct and durable generation use this path. It skips fresh music/research collection. Revisions reuse the draft's brief unless another ID is supplied.

Unavailable, superseded, wrong-purpose, multi-request or mismatched-song snapshots stop generation. Access and evidence are rechecked before the durable draft save and before publishing; immediate generation also rechecks before saving. This does not retract previously published output automatically after a later withdrawal.

Initial public-output scope is release/artist metadata, song summaries and artwork observations attributed entirely to public Spotify track/artist, cover or preview URLs. Raw lyrics, customer assertions, private uploads and arbitrary web research are excluded. Missing/excluded topics remain explicit gaps. This is deliberately narrower than the full internal brief; it does not grant publication rights to private context. Models must distinguish stored analysis from fresh listening and creative proposals from facts.

Example HTTP body for `PATCH /api/sites/{id}`:

```json
{"action":"generate","revision":0,"contextBriefId":"SAVED_BRIEF_UUID","background":true}
```

The saved draft retains internal evidence for review. Public responses already strip the entire production context and brand-world specification. Normal Sites credit checks, asset limits, concept gate and rendered review remain in force.
