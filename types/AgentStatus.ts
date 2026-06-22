/**
 * Steps/states an agent can be in during its lifecycle.
 * Migrated from chat/types/Funnel.tsx
 */
export enum STEP_OF_AGENT {
  INITIAL,
  ERROR,
  FINISHED,
  MISSING_POSTS,
  RATE_LIMIT_EXCEEDED,
  UNKNOWN_PROFILE,
  PROFILE,
  POSTURLS,
  ALBUMS,
  TRACKS,
  POST_COMMENTS,
  SEGMENTS,
  SETTING_UP_ARTIST,
  SAVING_ANALYSIS,
  CREATED_ARTIST,
}

/** Terminal states that indicate the agent is no longer running. */
export const TERMINAL_AGENT_STATUSES = [
  STEP_OF_AGENT.FINISHED,
  STEP_OF_AGENT.ERROR,
  STEP_OF_AGENT.UNKNOWN_PROFILE,
  STEP_OF_AGENT.RATE_LIMIT_EXCEEDED,
  STEP_OF_AGENT.MISSING_POSTS,
];
