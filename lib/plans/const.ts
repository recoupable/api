/**
 * When the task gate shipped. Tasks created before this keep running through
 * the grandfather window so their owners can pick a plan; tasks created after
 * it are checked on every run (a downgraded account loses its extra tasks
 * immediately).
 */
export const TASK_GATE_LAUNCHED_AT = "2026-09-01T00:00:00.000Z";

/** After this date a pre-gate task outside its plan's limits is skipped instead of run. */
export const TASK_GATE_GRANDFATHER_UNTIL = "2026-10-01T00:00:00.000Z";
