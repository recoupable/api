import { CONTENT_AGENT_REQUIRED_ENV_VARS } from "./validateContentAgentEnv";

/**
 * Returns true if all required content agent environment variables are set.
 *
 * @returns Whether the content agent is fully configured
 */
export function isContentAgentConfigured(): boolean {
  return CONTENT_AGENT_REQUIRED_ENV_VARS.every(name => !!process.env[name]);
}
