# Music Flamingo (Modal)

This is the deploy source for the Recoup `music-flamingo` Modal app that
backs `POST /api/songs/analyze`. Merging this repo does **not** deploy
the GPU function. After merge:

```bash
modal deploy modal/serve_music_flamingo.py
```

`MAX_CONTAINERS` is 4 (workspace GPU cap is 10). Recoup `full_report`
fans out 13 HTTP calls; they only run in parallel if this cap is >1.

The generate HTTP URL is unauthenticated. Recoup API is the auth
boundary. Do not point clients at the Modal URL.
