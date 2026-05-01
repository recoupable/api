import { slackGet } from "./slackGet";

interface AuthTestResponse {
  ok: boolean;
  error?: string;
  user_id?: string;
}

/**
 * Returns the authenticated bot's Slack user ID via auth.test.
 */
export async function getBotUserId(token: string): Promise<string> {
  const authTest = await slackGet<AuthTestResponse>("auth.test", token);
  if (!authTest.ok || !authTest.user_id) {
    throw new Error(`Slack auth.test failed: ${authTest.error ?? "unknown error"}`);
  }
  return authTest.user_id;
}
