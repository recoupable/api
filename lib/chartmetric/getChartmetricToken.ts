/**
 * Exchanges the Chartmetric refresh token for a short-lived access token.
 *
 * @returns The Chartmetric access token string.
 * @throws Error if the token exchange fails or the env variable is missing.
 */
export async function getChartmetricToken(): Promise<string> {
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

  const data = (await response.json()) as { access_token: string; expires_in: number };

  if (!data.access_token) {
    throw new Error("Chartmetric token response did not include an access_token");
  }

  return data.access_token;
}
