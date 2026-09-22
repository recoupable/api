import { z } from "zod";
/** One provider per credential scope. Never persist tokens in context traces. */
export function createChartmetricTokenProvider(
  refreshToken: string,
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
) {
  z.string().min(1).parse(refreshToken);
  let cached: { token: string; expires: number } | undefined;
  let pending: Promise<string> | undefined;
  return async function getAccessToken(): Promise<string> {
    if (cached && now() < cached.expires) return cached.token;
    if (pending) return pending;
    pending = (async () => {
      const response = await fetcher("https://api.chartmetric.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshtoken: refreshToken }),
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
      if (!response.ok) throw new Error(`Chartmetric token exchange HTTP ${response.status}`);
      const value = z
        .object({ token: z.string().min(1), expires_in: z.number().positive() })
        .parse(await response.json());
      cached = { token: value.token, expires: now() + Math.max(0, value.expires_in - 60) * 1000 };
      return value.token;
    })();
    try {
      return await pending;
    } finally {
      pending = undefined;
    }
  };
}
