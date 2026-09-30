# Release-to-experience production

HTTP and MCP accept URL-only generation. Omit `approvedConcept` to let the durable engine collect context and select a concept automatically. Passing an explicit concept preserves that choice. No assistant-side stage execution is required.

1. For Spotify tracks, create/reuse a saved Context Engine metadata request and its confirmed recording subject.
2. Acquire full audio through the existing Apify connection and verify it in an isolated worker against the Spotify preview (at least 15 seconds, correlation >= 0.95, duration within two seconds). Persist private mono 16 kHz WAV, run and save the lyric preset, run and save musical analysis and transcript-informed paraphrased themes, and save artwork observations and public artist research. Each operation is a durable stage. Missing preview or failed source matching stops explicitly; no preview is passed off as full audio.
3. Propose up to three short pitches starting with fan motivation. Metadata and cover details alone return `needs-context` without a concept model call. The model may also return `no-good-concept`. An automatic selection stage picks a candidate unless the caller supplies one. Generation develops only that selected pitch, then independently checks that the plan preserves it and has real appeal. No automatic paid brainstorming loop.
4. Choose up to two production assets by purpose: GPT Image 2 (Gateway), Nano Banana Pro (Fal), or one silent 4–6 second Seedance 2.5 clip (Higgsfield). Store normalized images or bounded MP4 in workspace storage with model/rationale/request provenance. Existing-draft art revisions can replace the asset plan through the skill agent while preserving the game contract.
5. Pass context and real asset URLs through the reusable brand-world and implementation modules.
6. Render mobile and desktop in an isolated Vercel Sandbox. Execute the complete structured journey using accessible controls, verify expected visible outcomes, capture initial/final states, runtime errors and horizontal overflow. Reopen downloaded/shared image bytes in a separate page, reject blank/invalid outputs and include the actual artifact in visual review.
7. Critique screenshots. A direction failure saves needs-review and returns to customer concept selection; it never silently changes the chosen activity. Asset/implementation fixes repeat build and rendered review until they pass; there is no fixed review-count cutoff. Each repair receives the current candidate and latest concrete review. Provider failures still stop production, and a rejected concept requires customer selection rather than silently replacing the activity.
8. Save a private draft with evidence and reviews. Rejected concepts are marked needs-review; implementation findings remain in the automatic repair loop. Publishing remains a separate customer action.

## Execution and billing

Default generation starts a durable workflow in `app/workflows/sites`; `get_site_generation` polls an account/site-bound signed token. The editor remembers the token for refresh recovery. An expected-revision claim prevents two requests with the same revision from starting duplicate work. Final save checks access and revision again. Failed stages do not overwrite the draft or automatically retry billable work. Completed workflow stages are reusable on resume.

Models use SITES_MODEL (default openai/gpt-6-astra). Token calls use chat credit accounting; research, music analysis and generated images use existing service credit paths. Credit checks occur before paid stages. There is no aggregate reservation protecting against simultaneous jobs, and sandbox hosting costs are not yet separately metered. Maximum image count is four across initial production and one revision.

SITES_JOB_SECRET can provide a dedicated job-signing key; otherwise SUPABASE_KEY is used. Tokens expire after seven days and do not replace normal API/workspace authentication. Rotating the signing key invalidates outstanding poll tokens.

## Limits

Full-track acquisition requires an available Spotify verification preview and a matching YouTube recording. Audio analysis requires the existing Music Flamingo service credentials. Albums/playlists currently receive basic metadata rather than per-track audio analysis. Research is sourced search evidence, not verified biography. Rendering checks the planned generated-experience journey, not Spotify authentication, every game branch, or real native OS sharing. Native sharing is intercepted to validate the actual image File payload. Missing or failed journeys force needs-review even if the visual critic says pass. Verification evidence and limitations are stored with each review. The trusted login/player components retain their existing theme contract. Screenshot review is bounded feedback, not a guarantee of artist approval.

Run focused tests with `pnpm exec vitest run lib/sites/__tests__`. The isolated-browser smoke test is opt-in via SITES_RENDER_LIVE_TEST=1 and incurs a sandbox run.

## Capability contract

`experienceContract.ts` is the shared production capability registry. The director and builder receive the same limits. Supported: local browser interactions, production-time image assets, real image exports, and native image-file sharing with a download fallback. Visitor-time AI image/video/music generation, hosted personalized result URLs, and server-backed scores are not wired into the generated runtime and must not be promised. Add a capability only alongside its working runtime implementation and journey verification. No model-written test code is executed: the runner supports bounded click, fill, keypress, download and share actions.

The concept gate assesses release relevance, fan value, feasibility and journey completeness; this is a fallible model judgment, not proof of artistic value. Screenshot review also judges the actual exported artifact. A reviewed result establishes only the recorded test scope, never artist endorsement.

## Saved Context Engine handoff

Pass `contextBriefId` to the HTTP generate action or MCP `generate_site`. Save a `creative_direction` brief through `/api/context` first. Sites reads the snapshot server-side in the site's workspace, matches its Spotify track, and forwards accepted evidence with document/result/source versions, coverage and missing topics to the director, independent concept review, brand-world planner and implementation generator. Both direct and durable generation use this path. It skips fresh music/research collection. Revisions reuse the draft's brief unless another ID is supplied.

Unavailable, superseded, wrong-purpose, multi-request or mismatched-song snapshots stop generation. Access and evidence are rechecked before the durable draft save and before publishing; immediate generation also rechecks before saving. This does not retract previously published output automatically after a later withdrawal.

Public-output scope is release/artist metadata, song summaries, artwork observations and saved public-search artist research. Audio summaries retain their public YouTube provenance; research retains public citations in its content. Raw lyrics, customer assertions and private uploads are excluded. Missing/excluded topics remain explicit gaps. This is deliberately narrower than the full internal brief; it does not grant publication rights to private context. Models must distinguish stored analysis from fresh listening and creative proposals from facts.

Example HTTP body for `PATCH /api/sites/{id}`:

```json
{"action":"concepts","revision":0,"contextBriefId":"SAVED_BRIEF_UUID"}
```

The saved draft retains internal evidence for review. Public responses already strip the entire production context and brand-world specification. Normal Sites credit checks, asset limits, concept gate and rendered review remain in force.

## Concept selection contract

PATCH `/api/sites/{id}` with `action: "concepts"`, current `revision`, optional `instruction` and `contextBriefId`; MCP uses `propose_site_concepts`. This may spend on context collection and one pitch call, but creates no assets, implementation or draft changes. Response: `{ concepts: { status, candidates, reason }, revision }`. Status is `ready`, `needs-context`, or `no-good-concept`.

Each candidate contains `name`, `activity`, `fanMotivation`, `songOrArtistConnection`, and `friendHook`. Show these short pitches to the customer. After selection, call `generate` / `generate_site` with that full object as `approvedConcept`, latest revision and the same context brief. Explicitly customer-authored pitches are also accepted; this is a caller-confirmed choice, not a signed approval receipt. Omit the object for automatic selection inside production. Without a saved brief, context may be collected again during generation.

Metadata and artwork alone do not establish a worthwhile fan activity; generation collects usable song analysis and sourced artist context before proposing concepts.

## Automatic full-context execution

The Sites workflow runs metadata, hosted acquisition, lyrics, summary, artwork, research, brief, concept, direction, assets, build, review, and save as durable stages. The direct server path uses the same domain collectors. Full audio is limited to 20 minutes and 40 MB. The disposable worker installs pinned yt-dlp, numpy and imageio-ffmpeg for discovery and verification, receives only metadata, a public verification preview and provider audio bytes, and is stopped in a finally block. Hosted retrieval uses Apify’s maintained downloader, with at most three candidates, a $0.30 event cap per candidate and actual-cost credit accounting. Application credentials remain outside the worker.

The lyric result remains private and unverified. Summary normalization consumes only a transcript with the matching audio checksum; its result ID is part of the cache key. Sites receives the summary's paraphrased themes, artwork observations and public-search research through a saved brief. Raw lyrics and signed file URLs are not included in the public site payload.

Workflow failures name the stage. No automatic provider retry occurs after an ambiguous failure; completed accepted enrichment remains reusable. A failed reviewed concept does not trigger paid automatic brainstorming.

### Build progress

Authenticated generation polling may include `generation.progress` with `phase` (`queued`, `research`, `design`, `assets`, `build`, `review`), `detail`, and `reviewPass`. This additive field comes from workflow step metadata with `resolveData: "none"`; no prompts, inputs, or outputs are exposed. Revisions remain in `review` with a refinement message. Phase milestones describe the current workflow position, not percentages or time estimates. Missing progress is nonfatal; clients should keep observing the job. Existing in-flight workflows are supported without restarting them.
