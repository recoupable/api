# Pinned pure worker status resolver

`resolveOverallStatus.ts` is byte-identical to
`recoupable/tasks/src/content/resolveOverallStatus.ts` at
`fcb3a2ece849bd8210590f1079f2e8cc1b809203` (current Tasks main when verified).
SHA256: `b90be8f6811eb7bb1f65af1d3dd506c96d37bed31a25fc2da4e08175cb79ecf1`.
Do not format or edit this upstream fixture independently of its source pin.

The adjacent `pollContentRuns.ts` supplies only the structurally compatible
callback result type; it does not copy or execute polling. The resolver's import
is type-only. Tests execute this exact pure resolver to construct realistic
all-failed and mixed callbacks, then exercise the actual API validator/handler.
The fixture hash is checked by a test, and no worker SDK, provider or job runs.

At this worker revision, `sendContentCallback` forwards the resolver status and
results with no overall message. The poller maps rejected/non-COMPLETED runs to
failed; it does not currently emit explicit per-run timeouts. Timeout reporting
in completed callbacks is therefore defensive schema support, not evidence of
the ordinary worker timeout path. Changes to worker classification/polling are
outside these API notification tests.
