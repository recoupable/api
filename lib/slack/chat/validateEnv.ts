const REQUIRED_ENV_VARS = [
  "SLACK_CHAT_BOT_TOKEN",
  "SLACK_CHAT_SIGNING_SECRET",
  "SLACK_CHAT_API_KEY",
  "REDIS_URL",
] as const;

/**
 * Validates that all required environment variables for the Slack chat bot are set.
 * Throws an error listing all missing variables.
 */
export function validateSlackChatEnv(): void {
  const missing: string[] = REQUIRED_ENV_VARS.filter(name => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `[slack-chat] Missing required environment variables:\n${missing.map(v => `  - ${v}`).join("\n")}`,
    );
  }
}
