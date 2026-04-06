let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Reset cached token — for testing only.
 *
 * @internal
 */
export function resetTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}

/**
 * Exchanges the Chartmetric refresh token for a short-lived access token.
 * Caches the token until 60 seconds before expiry to avoid redundant API calls.
 *
 * @returns The Chartmetric access token string.
 * @throws Error if the token exchange fails or the env variable is missing.
 */
export async function getChartmetricToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const refreshToken = process.env.CHARTMETRIC_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error("CHARTMETRIC_REFRESH_TOKEN environment variable is not set");
  }

  const response = await fetch("https://api.chartmetric.com/api/token", {
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

  cachedToken = token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  return token;
}
