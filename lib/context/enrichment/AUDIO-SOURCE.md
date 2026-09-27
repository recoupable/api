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
