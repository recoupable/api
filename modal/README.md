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

The generate HTTP URL is unauthenticated. Recoup API is the auth
boundary. Do not point clients at the Modal URL.
