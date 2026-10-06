import type { OAuthAccess } from "./resolveOAuthAccess";

/** Keep provider/storage imports lazy while OAuth is disabled. */
export async function verifyOAuthBearer(token: string): Promise<OAuthAccess | undefined> {
  if (process.env.OAUTH_ENABLED !== "true") return undefined;
  const { getOAuthRuntime } = await import("./getOAuthRuntime");
  return getOAuthRuntime().verifyAccess(token);
}
