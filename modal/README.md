# Music Flamingo (Modal)

This is the deploy source for the Recoup `music-flamingo` Modal app that
backs `POST /api/songs/analyze`. It runs in the `shared-78369` Modal
workspace.

## Deploying

GitHub Actions deploys it: every push to `main` that touches `modal/**`
runs `.github/workflows/deploy-modal.yml`, which executes
`modal deploy modal/serve_music_flamingo.py` against `shared-78369`.
To redeploy without a code change, run the workflow from the Actions tab
(`workflow_dispatch`). Do not deploy from a laptop; a local `modal deploy`
targets whatever workspace `~/.modal.toml` points at.

The workflow authenticates with the `MODAL_TOKEN_ID` and
`MODAL_TOKEN_SECRET` repository secrets, minted in the `shared-78369`
workspace settings.

## Capacity

`MAX_CONTAINERS` is 4 (workspace GPU cap is 10). Recoup `full_report`
sends its 13 sections as one `generate_batch` request, so one report holds
one container and the sections run one after another on it.

## Batches

`generate_batch` downloads (and transcodes) the audio once and answers up to
40 prompts against it. A prompt may carry `clip_start`/`clip_end` (seconds,
both or neither) to hear only that stretch, cut fresh from the one download
for each prompt, and its own `temperature`, `top_p` or `do_sample` to
override the batch's settings for that prompt alone. An answer from a clip
echoes `clip_start`/`clip_end`, so a caller can tell it was not answered from
the whole song. The validation and the batch loop are pure Python and tested
locally (ffmpeg and ffprobe must be on the PATH):

```bash
uv run --no-project --with modal --with pytest \
  python -I -m pytest modal/test_serve_music_flamingo.py -q
```

## Auth

Every web endpoint (`generate`, `generate_batch`, `health`) requires Modal proxy auth
(`requires_proxy_auth=True`): requests must carry `Modal-Key` and
`Modal-Secret` headers from a proxy auth token minted in the
`shared-78369` workspace settings. Recoup API sends them from the
`MODAL_PROXY_TOKEN_ID` / `MODAL_PROXY_TOKEN_SECRET` Vercel env vars
(`lib/flamingo/getModalProxyAuthHeaders.ts`). Requests without them get
`401 missing credentials for proxy authorization` before a GPU is
touched. Recoup API is the billing boundary; do not point clients at the
Modal URL.

# Song moments (Modal)

`serve_song_moments.py` is the deploy source for the `song-moments` Modal
app behind `POST /api/songs/moments`. It is CPU only: `song_moments.py`
measures the audio (beat grid, loudness, which passages repeat) to find a
song's sections and moments, and names sections from an optional lyric-sheet
section order. Recoup API then has Music Flamingo describe the moments in one
`generate_batch` request above, one prompt per moment with its
`clip_start`/`clip_end`, so the song downloads once and each prompt hears
only its clip.

The same workflow deploys it, after `music-flamingo`. Its `measure` endpoint
uses the same proxy auth as Music Flamingo; Recoup API calls it at
`SONG_MOMENTS_MEASURE_URL` (`lib/const.ts`).

The request may carry `tempo_hint` (BPM, 30–300, from metadata). The beat
tracker often locks onto a multiple of the real tempo; with a hint, the
tracked tempo is reconciled to whichever of t, t/2, 2t, 3t/4, 4t/3, 2t/3 or
3t/2 lands within 8 % of it, or the hint wins when none does. `tempo_note`
says which happened.

`song_moments.py` and `song_measure.py` have no Modal imports, so they run
locally on any audio file:

```bash
uv run --no-project --with librosa==0.10.2.post1 --with pyloudnorm==0.1.1 \
  python -I modal/song_moments.py song.mp3 --tempo-hint 86 "Verse 1" "Chorus" "Verse 2" "Chorus"
```

Their tests use synthetic signals with known answers (section times, a silent
two-beat gap, a chord in A):

```bash
uv run --no-project --with librosa==0.10.2.post1 --with pyloudnorm==0.1.1 --with pytest \
  python -I -m pytest modal/test_song_moments.py modal/test_song_measure.py -q
```

## Extended measurement

`song_measure.py` adds, on the stereo signal at 44.1 kHz, every number a song
report draws. `sections`, `moments`, `energy_curve`, `ending` and the other
base fields stay at the top level unchanged; `measured_with` becomes
`<base version>+extended-<date>` so stored results can be rerun when either
part changes.

| Field | What it is |
| --- | --- |
| `lufs` | Integrated loudness from ffmpeg `ebur128` on the stereo file. `loudness_lufs` is replaced by the same figure, so there is one loudness number (the mono pyloudnorm estimate stands only when ffmpeg cannot read the file). |
| `true_peak_dbtp`, `loudness_range_lu` | From `ebur128`; `null` when no file path is given or ffmpeg fails. |
| `sample_peak_dbfs`, `crest_factor_db` | Highest sample, and peak minus RMS. |
| `broadcast_ready` | True peak ≤ -1 dBTP and -16 to -7 LUFS; `null` when true peak is unknown. |
| `stereo` | `lr_correlation` and `side_to_mid` (side RMS over mid RMS; 0 is mono). |
| `spectral_centroid_hz`, `rolloff95_hz` | Brightness: mean centroid and 95 % roll-off. |
| `band_profile` | Seven bands (sub, low, low_mid, mid, high_mid, high, air): `share_pct` of the mix's energy (sums to about 100), `side_pct`, `level_pct` against a typical pop split (50 = on the reference) and `status` (clear, heavy, light; ±4 dB). |
| `fingerprint` | Six 0–1 axes: organic_electronic, sparse_dense, dark_bright, intimate_anthemic, smooth_textured, slow_fast. `fingerprint_inputs` carries the raw measurements (flatness, contrast, zero-crossing spread, percussive ratio, onsets per second). |
| `key` | `tonic`, `mode` and `confidence` (Krumhansl profile correlation). |
| `time_signature` | `3/4` or `4/4`, from beat-strength periodicity. |
| `valence`, `arousal` | The measured half of mood (mode, brightness, energy, tempo); a listening model's mood words should refine valence. |
| `mute_drops` | Level drops against the preceding eight beats, and breakdowns against the whole song: `mute` under two beats (a zero-bleed cut), `breakdown` two or more; breakdowns within three beats merge. Local drops start after the first eight beats, whole-song breakdowns after the first section; none start inside the ending or the last three seconds, and a drop must recover before the ending starts. |
| `chord_loop` | One diatonic chord per bar and the most common four-bar cycle. Always `confidence: "low"`; treat it as one vote beside a listening model's answer. |
| `edit_points` | Typed `in`/`out` points: cold open, chorus entries and exits, the three deepest mutes, breakdowns and their re-entry, and last, where the fade begins or the band stops. |
| `ending`, `ending_detail` | How the song ends, read from `energy_curve` (see below). `ending` keeps its two values: `fade`, or `cold` for both kinds of stop. |
| `sections[].arrangement`, `arrangement_notes` | Per-section arrangement density and the notes drawn from it (see below). |
| `tempo_note` | How `tempo_bpm` was decided (see `tempo_hint` above). |

**Ending.** `ending_detail.type` is read from the per-second energy curve
against its median non-silent second. After the last second at 50 % or more of
the median, the closing silence is the final run of seconds under 10 %. `stop`
when the next second is already under 30 %; `stop_with_tail` when, after such a
stop, seconds at 5–30 % add up to three or more before the closing silence (a
ringing chord, a room, a short coda); `fade` when there is no stop and four
seconds or more pass from the last loud second to the closing silence; `stop`
otherwise. A fade carries `from` and `silent_from`, a stop `stop_at` and
`silent_from`, a stop with tail `stop_at` and `tail_until`; all carry `mmss`. The
energy curve is scaled between its 5th and 98th percentile seconds, so a short
fade only reads as one when quieter seconds elsewhere set the floor; several
seconds of digital silence at the end can push a stop one second late.

**Arrangement.** Each section carries `arrangement`, to one decimal:
`percussive_pct` (the percussive share of its energy, from the same
harmonic/percussive split the fingerprint uses), `onsets_per_s`, `high_pct` and
`sub_pct` (its spectral energy at or above 2 kHz and below 120 Hz) and `rms_db`.
`arrangement_notes` compares each section with the median section, leaving out
sections that lie mostly inside the ending: `sparse open` when the first section
is both the quietest and the brightest; `drums drop out at m:ss` when a section
has under one onset a second while its RMS stays within 6 dB of the median; and
`band thins at m:ss` when its percussive share and onset rate both fall more
than 35 % below the median (not repeated where the drums drop out). The first
section gets neither of the last two, which describe a change.

**Calibration caveat.** The fingerprint formulas and the band reference split
were calibrated on two songs (2026-11-04). They give plausible, comparable
numbers but are not norms; a pass over a larger corpus should replace the
constants in `song_measure.py` (and bump `EXTENDED_VERSION`).

The extended analysis is the slow part: about 25 s for a four-minute song on a
laptop, most of it the harmonic/percussive split behind the fingerprint, and
about 5.5 GB peak for a fifteen-minute file, hence `MEMORY_MB = 8192`.
