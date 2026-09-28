# YouTube audio acquisition

Legacy worker helpers plus the Sites production acquisition adapter. `acquireVerifiedAudioInSandbox` is called by the Sites durable audio stage.

1. Search using confirmed recording title and credited artists.
2. Screen candidate metadata: title, all artists, duration within three seconds, alternate versions, ambiguity.
3. Download a selected candidate with yt-dlp, then validate the audio stream and duration with ffprobe and decode with ffmpeg.
4. Normalize to mono 24 kHz PCM WAV, verify codec and duration, and decode the analysis copy. Preserve original and normalized hashes in separate trace steps.
5. Return normalized audio bytes and a trace to the caller's authenticated storage adapter. Temporary files are removed on success and failure.

Runtime requires current yt-dlp (with its YouTube JavaScript components), Node, ffmpeg and ffprobe. Run in a bounded background worker/sandbox, not an HTTP request. Commands ignore user configuration and do not inherit provider credentials or browser cookies. Execution has a three-minute timeout; acquisition is limited to two-hour recordings and a 100 MiB output file. Worker infrastructure must also enforce disk and memory quotas.

The matcher is a conservative metadata screen, not an acoustic fingerprint. It does not prove official channel identity or the exact clean/explicit master. Source channel and selection reasons remain visible. Multiple plausible candidates stop for review. No automatic fallback to previews and no provider retries.

The legacy helpers below do not provide: authorized existing-audio lookup, worker deployment, private asset persistence and signed analysis URLs, fingerprint/stronger version verification, durable scheduling and Music Flamingo handoff. Do not pass this asset to the existing preview-only Music Flamingo adapter without explicitly handling coverage. The hosted Sites adapter described below owns production wiring; unit tests do not establish a successful hosted download.

## Sites hosted adapter

`acquireVerifiedAudioInSandbox` uses an isolated Vercel Sandbox for bounded candidate search and normalized waveform correlation against the Spotify preview. The Sites adapter downloads candidates through the existing Apify connection using `streamers/youtube-video-downloader`; direct cloud yt-dlp downloads hit YouTube sign-in checks. The provider receives only public candidate URLs, stores the requested MP3 in temporary Apify storage, and never receives Recoup storage credentials. Recoup downloads the bounded file server-side and passes bytes into the verification sandbox. It emits the 16 kHz PCM16 WAV required by `collectContextAudioSource`. The older 24 kHz helpers above are not used for that path. Failure to verify a match stops the workflow; metadata similarity alone is insufficient. The Sites caller owns authorization and private storage.

Each acquisition tries at most three screened candidates. Each hosted download has a $0.30 provider-event cap and a 180-second timeout, requests no transcription, checks Recoup credits first, and charges the reported provider cost. Ambiguous paid starts are not retried automatically. A provider file is not an accepted recording until its waveform and duration pass verification. Hosted download failures remain possible; no cookies or login bypass is used.

Provider contract: https://apify.com/streamers/youtube-video-downloader/input-schema and https://apify.com/streamers/youtube-video-downloader/output-schema.
