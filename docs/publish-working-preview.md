# Publishing a working preview

`PATCH /api/sites/:id` accepts `{ action: "publish", revision, generationToken?, returnUrl? }`.
Without a token it publishes the finalized draft. With the signed generation token it reads the latest complete source snapshot from that account's build, including music context. It works while review is running or after review fails; approval is advisory. There must be a finished source snapshot, a paid workspace, and valid artist/fan configuration. Older-generation and cross-account tokens are rejected.

Publishing and unpublishing change only the live snapshot and publication metadata. They do not advance the draft revision, so a running builder can still save its draft. Completing review never updates the live publication; the customer must publish again to release further changes. Draft changes still use revision compare-and-swap.
