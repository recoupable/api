/**
 * Submodule configuration mapping for PR creation.
 * Defines the GitHub repo and base branch for each submodule.
 */
export const SUBMODULE_CONFIG: Record<string, { repo: string; baseBranch: string }> = {
  api: { repo: "recoupable/recoup-api", baseBranch: "test" },
  chat: { repo: "recoupable/chat", baseBranch: "test" },
  tasks: { repo: "recoupable/tasks", baseBranch: "main" },
  docs: { repo: "recoupable/docs", baseBranch: "main" },
  database: { repo: "recoupable/database", baseBranch: "main" },
  remotion: { repo: "recoupable/remotion", baseBranch: "main" },
  bash: { repo: "recoupable/bash", baseBranch: "main" },
  skills: { repo: "recoupable/skills", baseBranch: "main" },
  cli: { repo: "recoupable/cli", baseBranch: "main" },
};

/**
 * Returns the list of allowed Slack channel IDs from the environment.
 */
export function getAllowedChannelIds(): string[] {
  const raw = process.env.CODING_AGENT_CHANNELS;
  if (!raw) return [];
  return raw
    .split(",")
    .map(id => id.trim())
    .filter(Boolean);
}

/**
 * Returns the list of allowed Slack user IDs from the environment.
 */
export function getAllowedUserIds(): string[] {
  const raw = process.env.CODING_AGENT_USERS;
  if (!raw) return [];
  return raw
    .split(",")
    .map(id => id.trim())
    .filter(Boolean);
}
