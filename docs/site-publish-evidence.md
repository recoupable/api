# Unwired publication evidence contract

Status: source/offline contract only. `assessSitePublishEvidence` has no production callers, storage adapter, new public input, or publication side effect. Production continues to support [publishing working previews](./publish-working-preview.md), including before review finishes or after it fails.

## Existing decision and open acceptance

[API #959](https://github.com/recoupable/api/pull/959), source commit `71e65a8cad60dae2b741a6bfa2608db4037de611`, deliberately made review advisory: a complete playable build could otherwise be impossible to publish. It preserved signed generation/account/current-revision checks, paid workspace and artist setup, and publication without advancing the draft revision. This is the documented shipped decision; the PR is not a verbatim customer instruction.

[App #2094](https://github.com/recoupable/app/issues/2094) requires a passed report for the exact revision **or an explicit recorded override**. Its [November 6 comment](https://github.com/recoupable/app/issues/2094#issuecomment-6677970358) calls out #959's advisory review without a recorded override and leaves the publish decision open. This change supplies a reviewable contract for that criterion without silently changing the earlier behavior or claiming the whole issue complete.

## Assessment boundary

The internal helper receives only a site ID, expected revision and evidence ID as request data. Server dependencies supply the authenticated account, clock, authoritative candidate reader and persisted evidence reader. These are trust boundaries, not interchangeable client callbacks:

- The candidate reader must use the existing workspace authorization (`authorizeSiteWorkspace`), current site and expected-revision contracts. For a working build it must retain `readPublishableBuild`'s signed generation/account/current-revision validation. It returns the exact candidate intended for publication, not merely the current draft or its last review.
- The record reader must read server-owned immutable evidence scoped to site/workspace. An ID, digest, timestamp or `persisted: true` provided by a client does not establish persistence. This change supplies no such storage adapter.
- At recording time the server must derive the actor from authentication, authorize workspace access, capture its own timestamp, and compute the binding from the resolved candidate. Reports must come from the actual completed review. Overrides must capture an explicit `publish-without-passed-review` intent and nonempty reason for that candidate. A routine Publish click must not silently fabricate this record.

A satisfied result assesses evidence only. It is not publication authorization, human/artist approval, a database write receipt or proof of deployment. Exceptions from authoritative readers propagate; failed reads never become overrides.

## Identity and passing evidence

`getSitePublishIdentity` binds site, owner workspace, draft revision and a canonical SHA-256 of the candidate. JSON object keys are sorted so database key reordering does not change identity; array order and string bytes remain significant. The projection excludes only `production.reviews` and derived `production.status` to avoid self-reference. It includes context, direction, assets, design and other candidate fields. Record after assembling the actual publication candidate, including production context/direction; a pre-enrichment candidate is different and must not inherit an attestation. Mutable remote media bytes are not captured by URL hashes.

A recorded review additionally binds the complete report JSON through `reviewSha256`. A pass requires a pass verdict, no blocked/credit state, no blocking or direction findings, explicit generated-experience scope and human-approval-not-recorded metadata, and exactly one successful mobile and desktop result without errors or overflow. A supplied opening review must also pass without issues. Missing legacy binding metadata is insufficient; it is never synthesized from the current draft.

The actual document, executed journey and runner hashes are recomputed using `prepareSiteRenderArtifacts`, the same pure byte preparation now used by `renderExperience`. Use the executed journey retained in `review.verification.journey`, not the proposed direction contract. A changed candidate, document, journey, runner or report invalidates the corresponding record even if the draft revision is unchanged. No second renderer or provider loop is introduced. These checks do not prove native sharing, Spotify authentication, asset immutability or human usability.

An explicit override can satisfy this contract without a report, preserving the early-publish option. Its server-recorded actor must match the currently authenticated account, its timestamp cannot be in the future, and site/workspace/revision/candidate must match exactly. It still reports `humanApproval: "not-recorded"`; override intent is not creative approval. Existing records do not retroactively become overrides.

## Remaining activation decision and wiring

Root must reconcile how an explicit override is presented and recorded while preserving #959's early-publish intent. This source contract does not require mandatory artist approval. If accepted, the remaining work is to implement the authoritative record writer/readers and retention, expose explicit override intent in the existing authorized publish flow, and call the assessment on the actual resolved publication candidate. No DB schema or route changes are included here.

Publication must retain all existing paid/context/artist/workspace checks and `updateSitePublication`'s site/owner/revision compare-and-swap. Its current revision fence alone cannot stop a same-revision builder from changing a candidate between assessment and publication: publish the exact assessed snapshot, and enforce the accepted candidate/record binding atomically with publication. A concurrent revision change or access loss must fail. Do not advance the draft revision merely to publish; do not let later review completion overwrite the live snapshot. Record provenance and the publication transaction remain unimplemented and unqualified.
