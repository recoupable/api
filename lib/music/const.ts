/**
 * fal model id for MiniMax Music 3. Also the default stored on each row, so a
 * future model swap is a value change rather than a contract change.
 */
export const MUSIC_MODEL = "minimax/music-3";

/** How often the workflow asks fal whether a generation has finished. */
export const MUSIC_POLL_INTERVAL_MS = 10_000;

/**
 * Give up after this long. Generation normally takes one to two minutes; past
 * fifteen the request is not coming back, and a workflow that polls forever is
 * indistinguishable to the user from one that is still working.
 */
export const MUSIC_POLL_TIMEOUT_MS = 15 * 60 * 1000;
