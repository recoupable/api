import { z } from "zod";

const responseSchema = z.object({
  idToken: z.string().min(1).optional(),
  accessToken: z.string().min(1).optional(),
  expiresIn: z.union([z.number(), z.string()]).optional(),
});

/** The MLC data endpoints accept the OIDC idToken returned by /oauth/token. */
export function createMlcAccessTokenProvider({
  username,
  password,
  fetcher = fetch,
  now = Date.now,
}: {
  username: string;
  password: string;
  fetcher?: typeof fetch;
  now?: () => number;
}) {
  z.string().min(1).parse(username);
  z.string().min(1).parse(password);
  let cached: { token: string; expiresAt: number } | undefined;
  let pending: Promise<string> | undefined;
  return async function getAccessToken(): Promise<string> {
    if (cached && now() < cached.expiresAt) return cached.token;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetcher("https://public-api.themlc.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
      if (!response.ok) throw new Error(`MLC authentication HTTP ${response.status}`);
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error("MLC authentication returned an invalid response");
      }
      const parsed = responseSchema.safeParse(body);
      const token = parsed.success && (parsed.data.idToken ?? parsed.data.accessToken);
      if (!token) throw new Error("MLC authentication returned no token");
      const expires = Number(parsed.data.expiresIn ?? 3600);
      const ttl = Number.isFinite(expires) && expires > 0 ? expires : 3600;
      cached = { token, expiresAt: now() + Math.max(0, ttl - 60) * 1000 };
      return token;
    })();
    try {
      return await pending;
    } finally {
      pending = undefined;
    }
  };
}
