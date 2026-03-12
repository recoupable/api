const REQUIRED_ENV_VARS = [
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "GITHUB_TOKEN",
  "REDIS_URL",
  "CODING_AGENT_CALLBACK_SECRET",
] as const;

const WHATSAPP_ENV_VARS = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
] as const;

/**
 * Validates that all required environment variables for the coding agent are set.
 * WhatsApp variables are validated as a group — if any are set, all must be present.
 * Throws an error listing all missing variables.
 */
export function validateCodingAgentEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(name => !process.env[name]);

  const whatsappSet = WHATSAPP_ENV_VARS.filter(name => process.env[name]);
  if (whatsappSet.length > 0 && whatsappSet.length < WHATSAPP_ENV_VARS.length) {
    const whatsappMissing = WHATSAPP_ENV_VARS.filter(name => !process.env[name]);
    missing.push(...whatsappMissing);
  }

  if (missing.length > 0) {
    throw new Error(
      `[coding-agent] Missing required environment variables:\n${missing.map(v => `  - ${v}`).join("\n")}`,
    );
  }
}
