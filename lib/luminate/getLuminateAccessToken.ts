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
    const reader = response.body?.getReader();
    if (!reader) throw new FatalError("Empty Luminate authentication response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new FatalError("Oversized Luminate authentication response");
      }
      chunks.push(chunk.value);
    }
    let auth;
    try {
      auth = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new FatalError("Invalid Luminate authentication response");
    }
    if (
      !auth ||
      typeof auth !== "object" ||
      typeof auth.access_token !== "string" ||
      !auth.access_token
    )
      throw new FatalError("Invalid Luminate authentication response");
    const seconds =
      typeof auth.expires_in === "number" && auth.expires_in > 0
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
