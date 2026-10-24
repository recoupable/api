# Content callback failure and timeout counts

The existing [API #341 review finding](https://github.com/recoupable/api/pull/341#discussion_r2982849700)
still reproduces on current main. A completed batch with no videos loses its
observed failed-run count. Per-run timeouts are not reported even when other runs
produce videos. Historical review text is evidence, not authority to restore its
broader patch or expose raw provider errors.

A shared formatter now reports the supplied failed and timed-out run counts.
An overall-failed callback without a supplied message uses its known counts
instead of `Unknown error`. This covers the current worker's ordinary all-failed
and mixed completed/failed batches. Explicit overall messages, including empty
ones, remain exact; absent/empty results retain `Unknown error`.

For overall-completed callbacks, the no-video message includes counts when
present; media batches post one summary afterward. The existing failed-only summary is
byte-identical, and the media helper's new timeout-count argument defaults to
zero for existing three-argument callers. Missing/empty result arrays and
completed results without URLs retain the original no-video message rather than
being relabeled failures.

Callback authentication, validation, terminal-thread retry guard and state-write
ordering remain unchanged. A top-level completed callback still sets completed
after posting, even when individual results failed or timed out. Overall-failed
callbacks still set failed before posting and do not deliver mixed-batch media.
Top-level timeout handling, editorial-image-before-video order, captions, file
downloads, URL fallbacks and legacy media behavior remain unchanged. This adds
no generation, polling, retry, credit, scheduling or partial-dispatch policy.

Fourteen new tests exercise the actual callback validator, handler and media
helper with a mocked thread and fetch. Five reporting regressions fail before
the repair; nine controls pass. Mixed video-only and image/video cases retain
media payload/order and post one count summary before the existing terminal
state write. Existing callback/media tests retain auth, invalid-body, failed-only
summaries, file/URL fallback, captions and image MIME coverage. No actual chat
post, network/provider request, customer operation, database/state write or
credential inspection runs during verification.

Seven additional producer-path tests use a byte-pinned copy of the current pure
Tasks status resolver (`fcb3a2ece849bd8210590f1079f2e8cc1b809203`) with a type-only
bridge, without polling or loading its SDK. The all-failed and mixed-batch cases
fail on the first candidate and pass after correcting the overall-failed path.
Five controls verify fixture identity, explicit messages and no-results behavior.
Only the exact upstream fixture is excluded from formatting to preserve its hash.
Worker classification and sending source were read at that immutable revision;
the worker is not changed or executed. Current polling maps non-COMPLETED runs
to failed rather than explicit per-run timeout, so completed-status timeout tests
are defensive callback-contract coverage, not ordinary producer execution proof.

This addresses the bounded count-reporting concern in source. Per-run diagnostics,
image-only result policy, all original API #341 outcomes, atomic callback
deduplication and partially-started batch recovery remain separate. No delivery,
hosted-user, successful generation or production verification is implied by
mocked tests.
