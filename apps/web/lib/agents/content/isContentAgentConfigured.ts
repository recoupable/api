import { CONTENT_AGENT_REQUIRED_ENV_VARS } from "./validateContentAgentEnv";

/**
 * Returns true if all required content agent environment variables are set.
 *
 * @returns Whether the content agent is fully configured
 */
export function isContentAgentConfigured(): boolean {
  const missing = CONTENT_AGENT_REQUIRED_ENV_VARS.filter(name => !process.env[name]);
  if (missing.length > 0) {
    console.warn(`[content-agent] Missing env vars: ${missing.join(", ")}`);
  }
  return missing.length === 0;
}
