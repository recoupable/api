const REQUIRED_ENV_VARS = [
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "GITHUB_TOKEN",
  "REDIS_URL",
  "CODING_AGENT_CALLBACK_SECRET",
] as const;

/**
 * Validates that all required environment variables for the coding agent are set.
 * Throws an error listing all missing variables.
 */
export function validateCodingAgentEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(name => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `[coding-agent] Missing required environment variables:\n${missing.map(v => `  - ${v}`).join("\n")}`,
    );
  }
}
