# YouTube audio acquisition

Worker modules, not yet wired into the deployed Context Engine scheduler.

1. Search using confirmed recording title and credited artists.
2. Screen candidate metadata: title, all artists, duration within three seconds, alternate versions, ambiguity.
3. Download a selected candidate with yt-dlp, then validate the audio stream and duration with ffprobe and decode with ffmpeg.
4. Normalize to mono 24 kHz PCM WAV, verify codec and duration, and decode the analysis copy. Preserve original and normalized hashes in separate trace steps.
5. Return normalized audio bytes and a trace to the caller's authenticated storage adapter. Temporary files are removed on success and failure.

Runtime requires current yt-dlp (with its YouTube JavaScript components), Node, ffmpeg and ffprobe. Run in a bounded background worker/sandbox, not an HTTP request. Commands ignore user configuration and do not inherit provider credentials or browser cookies. Execution has a three-minute timeout; acquisition is limited to two-hour recordings and a 100 MiB output file. Worker infrastructure must also enforce disk and memory quotas.

The matcher is a conservative metadata screen, not an acoustic fingerprint. It does not prove official channel identity or the exact clean/explicit master. Source channel and selection reasons remain visible. Multiple plausible candidates stop for review. No automatic fallback to previews and no provider retries.

Production integration still needs: authorized existing-audio lookup, worker deployment, private asset persistence and signed analysis URLs, fingerprint/stronger version verification, durable scheduling and Music Flamingo handoff. Do not pass this asset to the existing preview-only Music Flamingo adapter without explicitly handling coverage. No production wiring or successful download is implied by unit tests.
