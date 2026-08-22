/**
 * fal model id for MiniMax Music 3. Also the default stored on each row, so a
 * future model swap is a value change rather than a contract change.
 */
export const MUSIC_MODEL = "minimax/music-3";

/**
 * How often the workflow asks fal whether a generation has finished. A
 * duration string rather than a computed Date: `sleep` accepts one directly,
 * and it keeps the wait independent of the workflow's logical clock.
 */
export const MUSIC_POLL_INTERVAL = "10s";

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
