import { chartmetricTokenCache } from "./chartmetricTokenCache";
import { CHARTMETRIC_BASE } from "./chartmetricBase";

/**
 * Exchanges the Chartmetric refresh token for a short-lived access token.
 * Caches the token until 60 seconds before expiry to avoid redundant API calls.
 *
 * @returns The Chartmetric access token string.
 * @throws Error if the token exchange fails or the env variable is missing.
 */
export async function getChartmetricToken(): Promise<string> {
  if (chartmetricTokenCache.token && Date.now() < chartmetricTokenCache.expiresAt) {
    return chartmetricTokenCache.token;
  }

  const refreshToken = process.env.CHARTMETRIC_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error("CHARTMETRIC_REFRESH_TOKEN environment variable is not set");
  }

  const response = await fetch(`${CHARTMETRIC_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshtoken: refreshToken }),
  });

  if (!response.ok) {
    throw new Error(`Chartmetric token exchange failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    token?: string;
    access_token?: string;
    expires_in: number;
  };

  const token = data.token || data.access_token;

  if (!token) {
    throw new Error("Chartmetric token response did not include a token");
  }

  chartmetricTokenCache.token = token;
  chartmetricTokenCache.expiresAt = Date.now() + (data.expires_in - 60) * 1000;

  return token;
}
