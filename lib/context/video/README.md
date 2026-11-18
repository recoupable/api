# Single-video evidence projection — CE15 fixture slice

`prepareContextVideoEvidence` prepares retained evidence for one saved YouTube
request using injected, authorized readers. It returns the existing
`ContextEnrichmentModule` and `ContextEnrichmentResult` shapes plus eligible saved
`ContextBriefDocument` artist-research documents. It performs no provider call,
media fetch, identity write, persistence, credit reservation or settlement.

This is the missing evidence projection for app#2131, not another ingestion action.
The separate open API#1019 saves a video locator only. Current public ingestion
still rejects YouTube execution. This module is not registered with HTTP, MCP,
workers or the enrichment scheduler. CE14, source retention/identity acceptance,
Database topic support, approved spending and hosted/native validation remain
separate prerequisites for a production connection.

## Contract

The actor and owner come from the shared authenticated operation. Readers must
return the selected owner's retained request/evidence and current authorized
artist documents. The function authorizes before reads and again before return;
it validates owner/request/video bindings, source-version membership, exact media
versions, distinct video/recording/artist identities and every analyzed range.
Source-backed identity is supplied by the reader, never inferred from a channel,
title or description. Validation of references is not independent identity proof.
An unresolved recording remains unresolved and triggers no artist-document read.

Uploader/channel, observed performers and credited artists are separate fields.
Live/remix/dubbed/unknown versions, missing captions, multilingual segments and
disjoint analyzed ranges remain explicit. Available metadata survives unavailable
captions or analysis. A reader exception remains an error; the adapter does not
hide authorization/storage failures as missing media. Readers represent known
module unavailability explicitly in the evidence envelope.

The sole projected topic is `video_narrative`, on the video subject, with
interpretation evidence and partial coverage. Captions are retained video evidence,
never original full-song lyrics. Visual observations and interpretations remain
separate within each range. This never updates `lyrics`, `song_summary`,
`artwork_branding` or `artist_brand`. Declared sources preserve original version
IDs, retrieval times and media versions; full input evidence remains in the module
fingerprint input rather than an abbreviated source summary. Prior provider cost
is unknown, not zero; preparing a projection does not authorize or settle spend.

Matched credited artists allow reuse of current accepted, source-backed
`artist_research` documents through the existing selection helper. Wrong-owner,
unrelated, withdrawn, creative-proposal, unknown-coverage and missing-result
records are excluded. Returned documents retain their original IDs, result IDs,
versions, text and source-version sets. No generation fallback exists. The reader
is responsible for current-version/access checks; selection is not a replacement
for those checks or an atomic snapshot guarantee.

No new brief recipe or snapshot field is introduced. Existing brief schema-v1,
full saved snapshots, six-key document manifests and compiler behavior remain
unchanged. `video_narrative` is currently outside the existing brief recipes;
future authorized integration must supply persisted documents through the shared
path rather than relabel this output as song/artist evidence or fabricate IDs.

## Local verification

Focused fixtures cover related artist reuse, label-channel attribution, alternate
versions, unresolved identity, multiple languages, partial ranges, unavailable
media, source/version and owner/request mismatch, revoked access and filtered
reuse. These demonstrate source behavior only; they do not establish collection,
Database acceptance, live accounting, ingestion or hosted availability.
