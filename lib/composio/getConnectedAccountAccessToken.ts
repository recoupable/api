import { getComposioClient } from "./client";

export interface ConnectedAccountTokens {
  accessToken: string;
  refreshToken: string | null;
}

/**
 * Retrieve the OAuth access (and refresh) token Composio holds for a
 * connected account, so we can call provider APIs that Composio's tool
 * catalog doesn't natively expose (e.g. YouTube Analytics).
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

  const accessToken = account.state.val?.access_token as string;
  if (!accessToken) {
    throw new Error(`Composio connected account ${connectedAccountId} has no access_token`);
  }

  return {
    accessToken,
    refreshToken: (account.state.val?.refresh_token as string | undefined) ?? null,
  };
}
