# Release-to-experience production

UI, HTTP and MCP use the same production stages. A Spotify URL is sufficient; a customer prompt is optional.

1. Resolve the release and artwork. Track metadata can supply an official preview.
2. Collect sourced artist research and analyze available audio through existing Recoup services. Missing evidence is recorded explicitly; previews are not full-song analysis.
3. Choose among distinct experience concepts and write the fan journey and asset plan.
4. Produce up to two finished images with the existing image service and store normalized assets in the workspace.
5. Pass context and real asset URLs through the reusable brand-world and implementation modules.
6. Render mobile and desktop in an isolated Vercel Sandbox. Capture initial and first-button states, runtime errors and horizontal overflow.
7. Critique screenshots. Route one revision to direction, assets or implementation, then review again.
8. Save a private draft with evidence and reviews. Persistent issues are marked needs-review. Publishing remains a separate customer action.

## Execution and billing

Default generation starts a durable workflow in `app/workflows/sites`; `get_site_generation` polls an account/site-bound signed token. The editor remembers the token for refresh recovery. An expected-revision claim prevents two requests with the same revision from starting duplicate work. Final save checks access and revision again. Failed stages do not overwrite the draft or automatically retry billable work. Completed workflow stages are reusable on resume.

Models use SITES_MODEL (default openai/gpt-6-astra). Token calls use chat credit accounting; research, music analysis and generated images use existing service credit paths. Credit checks occur before paid stages. There is no aggregate reservation protecting against simultaneous jobs, and sandbox hosting costs are not yet separately metered. Maximum image count is four across initial production and one revision.

SITES_JOB_SECRET can provide a dedicated job-signing key; otherwise SUPABASE_KEY is used. Tokens expire after seven days and do not replace normal API/workspace authentication. Rotating the signing key invalidates outstanding poll tokens.

## Limits

No full-track Spotify/YouTube download resolver. Audio analysis requires the existing Music Flamingo service credentials. Albums/playlists currently receive basic metadata rather than per-track audio analysis. Research is sourced search evidence, not verified biography. Rendering checks the generated experience, not Spotify authentication or exhaustive game behavior. The trusted login/player components retain their existing theme contract. Screenshot review is bounded feedback, not a guarantee of artist approval.

Run focused tests with `pnpm exec vitest run lib/sites/__tests__`. The isolated-browser smoke test is opt-in via SITES_RENDER_LIVE_TEST=1 and incurs a sandbox run.
