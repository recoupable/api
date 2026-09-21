# Context Engine acceptance scenarios

Updated 2026-09-21. This is an acceptance plan, not a claim that every scenario passes.

## What an input means

Collect context and create a campaign are separate actions. A Spotify URL identifies music; it does not establish the caller's rights, authorize a campaign, or identify which account should own private research.

- **Identity:** derive the account from its API key or verified login. Without authentication, use a temporary guest workspace. Do not create a customer login account merely because someone supplied a URL or email.
- **Destination:** use the personal account by default, or an explicitly authorized organization. Existing roster membership helps matching but a display-name match alone is not sufficient evidence.
- **Action:** `ingest` collects context; `read` reports progress; `brief` selects context for a task. Campaign/site creation is a separate explicit operation.
- **Source:** Sites, chat, MCP, direct API, or import should be recorded by the calling application for traceability. Source is descriptive, not permission to write or spend. A claimed source string is never proof of authentication.
- **Requested context:** topics select needed evidence. Future fill-gaps execution must inspect accepted versions, freshness, coverage, and recipe compatibility before deciding which modules to run.
- **Creative direction:** optional. It should not change factual extraction or contaminate neutral music analysis.

### Current contract versus proposed extension

Current authenticated API input: `action`, `url`, `idempotency_key`, optional `organization_id`, `topics`, `direction`. Account identity is supplied by authentication, not an arbitrary body field. Guest input is `action: start` plus `url`, with an HttpOnly session cookie.

The current contract does **not** accept source, campaign ID, site ID, or a create-campaign action. Add a validated invocation record (source, explicit intent, originating feature/run reference) before wiring background inference or downstream campaign creation. The same URL submitted from Sites and MCP should resolve the same music identities while preserving separate feature operations.

Sites may explicitly request `collect context -> create new experience`; MCP may explicitly request collection only. A conversational assistant can propose an action from the prompt, but must call a concrete tool action within the user's authorization. Merely mentioning a URL in a question should not automatically create records or incur enrichment spend.

## Core scenario matrix

| ID | Customer situation | Expected behavior | Current evidence / gap |
|---|---|---|---|
| S01 | Existing account/key submits a Spotify track | Authenticate, inspect authorized roster, collect into that account | Test run 1: real-key roster read 200; production context ingestion 404. Blocked deployment, not a pass |
| S02 | Artist is absent from the account and from public identities | Create artist identity, attach to roster, create missing recording and release context | Test run 2: isolated DB fixture passed |
| S03 | Artist exists; new song submitted | Reuse artist ID and compatible artist context; create only new recording/release data | Test run 3: isolated DB fixture passed |
| S04 | Same URL and retry key submitted again | Same request ID, no duplicate completed work | Test run 4: isolated DB fixture passed |
| S05 | Artist exists globally but not in this account | Reuse verified public identity, add permitted roster link; never copy another account's private context | Needs dedicated end-to-end run |
| S06 | Song exists but this track URL is new | Match verified ISRC; add provider mapping and release presentation, retain recording analysis | Needs dedicated alternate-release fixture |
| S07 | Exact song and release context already exist | Reuse unchanged accepted evidence; fill only eligible gaps | Metadata reuse tested locally; automatic paid gap filling not implemented |
| S08 | Same artist name, different Spotify IDs | Keep distinct identities; do not merge by name | Needs dedicated collision run |
| S09 | Existing Spotify mapping conflicts with ISRC or artist | Stop with actionable identity conflict; no partial identity mutations | Transactional rejection exists; dedicated visible run pending |
| S10 | Collaborations / featured artists | Preserve all identities and credit order; never imply legal rights or administration | Code supports credits; multi-artist acceptance run pending |
| S11 | Track belongs to an existing catalog | Link recording to the relevant authorized catalog without creating duplicates or asserting ownership | Catalog membership integration missing |
| S12 | Same recording appears on single and album | Reuse recording evidence, keep release artwork/presentation separate | Current release subject uses submitted track resource; album-level grouping needs validation/design |
| S13 | Existing customer edits disagree with provider refresh | Preserve customer correction; retain provenance for review | DB correction regression passed; not live-account proof |
| S14 | Existing evidence is newer than incoming result | Do not replace it with older context | DB regression coverage; visible version-comparison run pending |
| S15 | Authorized organization member submits a URL | Read/reuse only that organization's private context, preserve creator identity | Authorization unit coverage; live organization run pending |
| S16 | Caller requests another organization's context | Deny without leaking documents or creating records | Unit and DB isolation coverage; live HTTP/MCP run pending |
| S17 | Guest submits URL without signup | Save temporary work and metadata; create no customer login account | Guest DB coverage; live browser run pending |
| S18 | Guest signs up during collection | Verify signup, claim once, finish original job into account | Test run 5: DB handoff passed with simulated verified signup, not real Privy signup |
| S19 | Guest signs up after collection | Attach saved output without refetching; reuse account's existing identities/context | DB regression passed; live auth flow pending |
| S20 | Guest logs into an existing account containing the artist | Merge attachment using verified identities; preserve existing private context and corrections | Needs combined browser + preseeded account run |
| S21 | Claim retried or attempted by a different account | Same claimant gets same receipt; different claimant denied | DB and app tests; live browser run pending |
| S22 | Guest expires, clears cookies, switches browsers | Expired work cannot be claimed; no unauthenticated email-based recovery; explain inability to recover cookie-less work | Expiration DB tested; cross-device recovery not implemented |
| S23 | API/MCP request asks only to collect | Collect context, never create a site/campaign | Shared operation has no campaign creation; full MCP-key trace pending |
| S24 | Sites explicitly requests a new experience | Collect/reuse context, then create an independent draft associated with resolved artist/release | Sites-to-Context integration not yet connected |
| S25 | Existing campaign is explicitly targeted | Verify access, attach context to that campaign; never duplicate based solely on repeated URL | Campaign targeting contract missing |
| S26 | Chat asks a question containing a URL | Answer or explicitly request needed collection; do not infer unrelated campaign creation | Background intent routing not implemented |
| S27 | Invalid URL, album, playlist, unsupported YouTube | Validate before provider spend; explain unsupported input | Parser/operation unit coverage; scenario traces pending. Only Spotify tracks ingest today |
| S28 | No preview/full audio, incomplete lyrics, missing artwork | Continue independent modules; mark coverage/missing sources honestly; never call snippet analysis full-song understanding | Paid pilot reports partial evidence; production enrichment dispatch missing |
| S29 | Provider timeout/rate limit/failure | Persist failure and completed steps; bounded retry; no duplicate accepted results | Metadata failure/retry DB tests; provider fault injection pending |
| S30 | Worker crashes, runs twice, returns late | One effective worker; stale result rejected; resume saved job | Fencing covered locally; hosted workflow crash/recovery pending |
| S31 | Concurrent tabs submit/claim the same work | Atomic identity and claim resolution; no duplicate roster/context | SQL serialization present; actual concurrent-process stress test pending |
| S32 | Credits insufficient or guest allowance exhausted | Stop before paid work; no unapproved charges; preserve free progress | Guest quota DB tested; production paid settlement/reservation pending |
| S33 | Signup finishes but email delivery fails | Saved context survives; notification retries without rerunning enrichment | Notification integration missing |
| S34 | API/MCP/browser perform the same authorized operation | Same identities, scope rules, outcomes and trace contract | Shared domain functions; full transport equivalence proof pending |
| S35 | Source text contains instructions or misleading identity claims | Treat source content as evidence; ignore executable instructions; preserve uncertain attribution | Requires adversarial enrichment fixtures |

## Test run record

Every run should record:

- Stable run number, scenario ID, start/end time, environment, code/migration versions.
- Input URL, normalized URL, caller source and explicit action. Redact secrets; restrict account and roster details to the local inspector/authorized owner.
- Verified caller and destination, or guest identity; never infer the account from the environment-variable name.
- Before/after artist IDs, provider IDs, recording/ISRC, release IDs, catalog and campaign links where implemented.
- Each step's input, output, created/reused/updated/skipped decision, evidence/reason, timing, error and retry count.
- For model calls: model, exact prompt, media references, response, measured usage and reported cost. Unknown cost stays unknown.
- Expected assertions and actual results. Authentication success is not identity-resolution success; an accepted job is not completed collection.
- Partial evidence and unexecuted steps. Planned steps must never appear as recorded successes.

## Recorded runs on 2026-09-21

1. Production API-key test: authorized roster read succeeded. Ingest endpoint returned 404. No identity resolution or context persistence was observed.
2. Isolated database: synthetic new artist + recording + release context created; assertions passed; transaction rolled back.
3. Isolated database: second synthetic recording reused the first artist; assertions passed; transaction rolled back.
4. Isolated database: duplicate request resolved to original ID and no completed worker was admitted; assertions passed.
5. Isolated database: simulated signup during guest work retained request identity and revoked guest read access; assertions passed.

The local React Flow inspector reads these redacted records under `context-scenarios`. Local fixture runs do not prove production auth, provider extraction, Vercel Workflow, catalog links, paid enrichment or notification delivery.

## Next execution order

1. Resolve PR checks and review database/API changes, then obtain merge approval and verify migration/deployment. Do not silently run production SQL to make tests pass.
2. Repeat S01 with the configured key; verify account identity and existing artist matches before asserting that this is the intended customer's workspace.
3. Run read-only checks and explicitly tagged writes for S03/S07/S15/S16; record real before/after IDs and evidence versions.
4. Exercise REST and MCP equivalence, then guest -> actual signup -> claim through the browser.
5. Run concurrency and provider failure fixtures. Enable paid enrichment only with its settlement controls, then test missing/full audio and field-level gap filling.
6. Integrate Sites intent, campaign references, catalog membership and readiness emails; keep those separately visible until implemented and tested.
