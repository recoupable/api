import { readLuminateBody } from "./readLuminateBody";
import { createHash } from "node:crypto";
import { FatalError, RetryableError } from "workflow";

let cached:
  | { key: string; fetcher: typeof fetch; expires: number; token: Promise<string> }
  | undefined;
/** Share server-memory authentication across tracks, invalidating on credential rotation or expiry. */
export async function getLuminateAccessToken(
  credentials: { apiKey: string; username: string; password: string },
  force = false,
) {
  const key = createHash("sha256").update(JSON.stringify(credentials)).digest("hex");
  if (
    !force &&
    cached?.key === key &&
    cached.fetcher === fetch &&
    cached.expires > Date.now() + 60000
  )
    return cached.token;
  const entry = { key, fetcher: fetch, expires: Date.now() + 86400000, token: Promise.resolve("") };
  entry.token = (async () => {
    const response = await fetch("https://api.luminatedata.com/auth", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        "x-api-key": credentials.apiKey,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ username: credentials.username, password: credentials.password }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429 || response.status >= 500)
        throw new RetryableError("Luminate authentication temporarily unavailable", {
          retryAfter: "1m",
        });
      throw new FatalError(`Luminate authentication unavailable (HTTP ${response.status})`);
    }
    const auth = await readLuminateBody(response, 16384, "Luminate authentication");
    if (
      !auth ||
      typeof auth !== "object" ||
      !("access_token" in auth) ||
      typeof auth.access_token !== "string" ||
      !auth.access_token
    )
      throw new FatalError("Invalid Luminate authentication response");
    const seconds =
      "expires_in" in auth && typeof auth.expires_in === "number" && auth.expires_in > 0
        ? Math.min(auth.expires_in, 86400)
        : 86400;
    entry.expires = Date.now() + seconds * 1000;
    return auth.access_token as string;
  })().catch(error => {
    if (cached === entry) cached = undefined;
    if (error instanceof FatalError || error instanceof RetryableError) throw error;
    throw new RetryableError("Luminate authentication temporarily unavailable", {
      retryAfter: "1m",
    });
  });
  cached = entry;
  return entry.token;
}
