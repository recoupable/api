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
