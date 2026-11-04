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
fans out 13 HTTP calls; they only run in parallel if this cap is >1.

## Auth

Both web endpoints (`generate`, `health`) require Modal proxy auth
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
section order. Recoup API then has Music Flamingo describe each moment by
sending `clip_start`/`clip_end` to the `generate` endpoint above, which cuts
the clip before the model hears it.

The same workflow deploys it, after `music-flamingo`. Its `measure` endpoint
uses the same proxy auth as Music Flamingo; Recoup API calls it at
`SONG_MOMENTS_MEASURE_URL` (`lib/const.ts`).

`song_moments.py` has no Modal imports, so it runs locally on any audio file:

```bash
uv run --no-project --with librosa==0.10.2.post1 --with pyloudnorm==0.1.1 \
  python -I modal/song_moments.py song.mp3 "Verse 1" "Chorus" "Verse 2" "Chorus"
```

Its tests use a synthetic song with known section times:

```bash
uv run --no-project --with librosa==0.10.2.post1 --with pyloudnorm==0.1.1 --with pytest \
  python -I -m pytest modal/test_song_moments.py -q
```
