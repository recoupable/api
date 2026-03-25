const REQUIRED_ENV_VARS = [
  "SLACK_CONTENT_BOT_TOKEN",
  "SLACK_CONTENT_SIGNING_SECRET",
  "CONTENT_AGENT_CALLBACK_SECRET",
  "REDIS_URL",
] as const;

/**
 * Returns true if all required content agent environment variables are set.
 *
 * @returns Whether the content agent is fully configured
 */
export function isContentAgentConfigured(): boolean {
  return REQUIRED_ENV_VARS.every(name => !!process.env[name]);
}

/**
 * Validates that all required environment variables for the content agent are set.
 * Throws an error listing all missing variables.
 */
export function validateContentAgentEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `[content-agent] Missing required environment variables:\n${missing.map(v => `  - ${v}`).join("\n")}`,
    );
  }
}
