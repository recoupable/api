# Verified recording audio

`collectContextAudioSource` registers an acquired, verified private recording as an
`audio_source` observation on its recording subject. It uses the normal Context Engine
claim/complete/reuse lifecycle. It does not call Music Flamingo or reproduce lyrics.

## Acquisition recipe verified in September 2026

1. Resolve the Spotify track's artist, title, ISRC, duration and preview.
2. Search YouTube for that exact recording; reject covers, remixes and wrong titles.
3. Download a candidate using a maintained yt-dlp installation with Node's JavaScript
   runtime. The verified installation used yt-dlp 2026.08.19 and audio format 140.
   Do not assume an expiring googlevideo URL is accessible from the analysis service.
4. Compare decoded mono waveforms at 2 kHz: slide the Spotify preview over the full
   candidate and compute normalized cross-correlation. This module conservatively
   requires at least 15 seconds, correlation >= 0.95, a valid offset, and total
   duration within two seconds of Spotify. These are acceptance gates for this
   recipe, not a general proof of identity or licensing.
5. Normalize the complete candidate to mono 16 kHz PCM16 WAV using ffmpeg. This
   format succeeded with the production analysis endpoint; the original M4A did not.
6. Upload without overwrite to private `user-files` storage under
   `<owner>/context-audio/<unique-id>.wav`. Compute its SHA-256.
7. Call `collectContextAudioSource` from trusted server/worker code with the verified
   manifest. Actor and workspace authorization are required. The module checks the
   saved recording ISRC and reads back the private WAV bytes to verify checksum,
   format and duration before accepting the result.
8. Downstream analysis authorizes access to the current document and generates a
   fresh short-lived signed URL with `createSignedFileUrlByKey`. Never persist a
   signed URL as evidence or put it into a public Sites brief.

## Scope

Apply database migration `20260927090000_context_audio_source.sql` first.
The saved result includes stable storage coordinates, checksum, duration, format,
source URLs, overlap evidence and an explicit `rightsVerified: false`.
Accepted compatible results reuse the module result without re-downloading audio.
Consumers must check file availability and authorization when signing it.

This is a server-only registration module and a documented acquisition recipe.
YouTube search/download execution is not yet a hosted automated collector or a
public endpoint. Never accept caller-supplied waveform scores as trusted evidence.
Missing previews or poor matches require review; do not silently substitute title
similarity for waveform verification. File storage and audio interpretations remain
separate modules, so changing an analysis prompt does not require downloading again.

## Analyze a saved source

`analyzeSavedContextAudio(actor, owner, requestId, subjectId, apiKey, deps)` loads
an accepted `audio_source` document from the authorized request, verifies the
private WAV checksum and duration, and signs a fresh 15-minute URL. It calls the
production Music Flamingo endpoint once for musical description and paraphrased
themes. Flamingo's response is treated as text, including Python-style dictionaries
and prose, rather than parsed as JSON. `generateContextObject` extracts validated
`musicalSummary`, `lyricalThemes`, and `uncertainties` fields without adding claims.
The original response and normalization trace remain in private result provenance;
the signed URL and API key are excluded.

The result is saved as `song_summary`, keyed to the audio result, checksum and
recipe. Accepted compatible results skip both paid calls. Total cost includes
Flamingo and structured extraction and is reported as unknown rather than as only
the extractor's cost. Provider or extraction failures require reconciliation, not
an implicit paid retry. This server collector does not itself schedule a job or
expose a public route; callers must supply authenticated actor/workspace context.

## Catalog metadata on a saved source

`analyzeSavedContextCatalogMetadata(actor, owner, requestId, subjectId, apiKey, deps)` runs the
existing `catalog_metadata` preset on the same accepted `audio_source` document, with the same
workspace authorization, checksum and duration verification, 15-minute signed URL and reuse path.
Before claiming an attempt it classifies the saved audio with `resolveSongEvidenceCoverage`,
which maps the evidence to one of `full`, `preview`, `wrong_recording` or `missing` plus a
`contextCoverageSchema` record (extent, identity, range, language). Only `full` evidence —
waveform-verified audio whose duration agrees with the recording — is sent for paid analysis;
unverified or disagreeing audio is refused before any claim or provider call. A language label
is passed through verbatim from the caller (for example a multilingual lyrics attribution) and
is never guessed.

The production endpoint applies the preset's JSON-like parser itself and returns either an
object or, when that fails, the raw text. `parseCatalogMetadataResponse` accepts both, applies
the same Python-dict tolerant parser to text, validates the result against a schema that mirrors
the preset's fields (all optional; no invented values) and returns `valid` or `invalid` with a
reason. Raw provider output, the parsed record, the coverage result and the accepted document
stay separate. Invalid structured output throws `ContextStructuredOutputInvalid`, so
`runContextEnrichment` marks the attempt failed and no `catalog_metadata` document is accepted;
`lyrics` and `song_summary` documents for the recording are untouched.

The result is saved under the `catalog_metadata` topic with key
`saved-audio-catalog-metadata-v1`. Its input includes the audio result ID, checksum and a
`presetVersion` hash of the local preset prompt and parameters, so a changed recipe is a new
paid call while a compatible accepted result is reused without one. The trace records the local
preset prompt and parameters, a provenance note that production resolves the deployed prompt,
the media manifest (coverage label, analyzed range, checksum, no URL), the raw response, the
validation status, timing and a billing note. The signed URL and API key are never persisted.
Cost remains `unknown` until CE07 cost references exist. The module is server-only; it does not
add an HTTP, MCP or workflow action, and failed-attempt traces are not yet persisted because
`fail_context_enrichment` accepts no reason.

## Lyric transcription

`analyzeSavedContextLyrics` uses the same saved-audio authorization, file verification,
short-lived URL and reuse path, but sends `preset: "lyric_transcription"` to the
production endpoint. It stores the returned text directly under the separate
`lyrics` topic with `transcriptionStatus: "machine-generated; unverified"`.
It does not parse the text as JSON or send it through the summary normalizer.
Coverage remains unknown because supplying a full recording does not establish
transcription completeness. The endpoint owns the preset's text postprocessing.

To run manually from the API checkout with the server environment configured:

```sh
npx tsx --env-file=.env.local scripts/analyzeContextLyrics.ts <request-id> <recording-subject-id> [workspace-owner-id]
```

The actor is resolved from `RECOUP_API_KEY`; workspace overrides require access.
The command prints only state/result ID. Read the private `lyrics` document through
the existing authenticated Context Engine document reader. A compatible accepted
result is reused without another paid call. No new migration is needed.
