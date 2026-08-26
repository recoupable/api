/**
 * fal model id for MiniMax Music 3. Also the default stored on each row, so a
 * future model swap is a value change rather than a contract change.
 */
export const MUSIC_MODEL = "minimax/music-3";

/**
 * How often the workflow asks fal whether a generation has finished.
 *
 * Passed to `sleep` as a Date, not as the "10s" duration string the docs
 * show. Both are documented, but on this deployment the string form recorded
 * a completed 9.97s sleep and then never resumed the run, while the Date form
 * resumed reliably every cycle. Same form `sandboxLifecycleWorkflow` uses.
 */
export const MUSIC_POLL_INTERVAL_MS = 10_000;

/**
 * Give up after this many polls, which at the interval above is fifteen
 * minutes. Generation normally takes one to two minutes; past fifteen the
 * request is not coming back, and a workflow that polls forever is
 * indistinguishable to the user from one that is still working.
 *
 * Counted rather than timed on purpose: see the loop in
 * musicGenerationWorkflow.
 */
export const MUSIC_MAX_POLL_ATTEMPTS = 90;
