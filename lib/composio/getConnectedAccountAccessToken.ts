import { getComposioClient } from "./client";

/**
 * OAuth tokens for a Composio connected account.
 */
export interface ConnectedAccountTokens {
  accessToken: string;
  refreshToken: string | null;
}

/**
 * Retrieve the OAuth access (and refresh) token Composio holds for a
 * connected account. Lets us call provider APIs that Composio's tool
 * catalog does not natively expose (e.g., YouTube Analytics).
 *
 * @throws when the account is not active or has no OAuth state.
 */
export async function getConnectedAccountAccessToken(
  connectedAccountId: string,
): Promise<ConnectedAccountTokens> {
  const composio = await getComposioClient();
  const account = await composio.connectedAccounts.get(connectedAccountId);

  if (account.status !== "ACTIVE") {
    throw new Error(
      `Composio connected account ${connectedAccountId} is not active (status: ${account.status})`,
    );
  }

  const val = (account.state as { val?: { access_token?: string; refresh_token?: string | null } })
    ?.val;
  const accessToken = val?.access_token;
  if (!accessToken) {
    throw new Error(`Composio connected account ${connectedAccountId} has no access_token`);
  }

  return {
    accessToken,
    refreshToken: val?.refresh_token ?? null,
  };
}
