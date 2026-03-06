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
