import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { getComposioClient } from "@/lib/composio/client";
import { getConnectors } from "@/lib/composio/connectors/getConnectors";

/**
 * TEMPORARY DIAGNOSTIC — remove once YouTube tool catalog is verified working.
 *
 * GET /api/debug/composio-youtube?artist_id=<id>
 *
 * Returns a step-by-step view of how Composio resolves the artist's YouTube
 * connection so we can pinpoint where YOUTUBE_GET_CHANNEL_STATISTICS is being
 * dropped.
 *
 * @param request - The incoming request (auth via x-api-key or bearer token)
 * @returns A JSON object with each Composio resolution step's result.
 */
export async function GET(request: NextRequest) {
  const authResult = await validateAuthContext(request);
  if (authResult instanceof NextResponse) return authResult;
  const { accountId } = authResult;

  const { searchParams } = new URL(request.url);
  const artistId = searchParams.get("artist_id");
  if (!artistId) {
    return NextResponse.json({ error: "artist_id query param required" }, { status: 400 });
  }

  const out: Record<string, unknown> = {
    accountId,
    artistId,
    youtubeAuthConfigIdSet: !!process.env.COMPOSIO_YOUTUBE_AUTH_CONFIG_ID,
  };

  try {
    out.checkAccountArtistAccess = await checkAccountArtistAccess(accountId, artistId);
  } catch (e) {
    out.checkAccountArtistAccessError = (e as Error).message;
  }

  const composio = await getComposioClient();

  // 1. connectors visible to the artist (session-based, includes authConfigs)
  try {
    const connectors = await getConnectors(artistId);
    out.getConnectors = connectors.map(c => ({
      slug: c.slug,
      isConnected: c.isConnected,
      connectedAccountId: c.connectedAccountId,
    }));
  } catch (e) {
    out.getConnectorsError = (e as Error).message;
  }

  // 2. raw connectedAccounts.list filtered by userId=artistId
  try {
    const list = await composio.connectedAccounts.list({ userIds: [artistId] });
    const items = ((list as { items?: unknown[] }).items ?? list) as Array<Record<string, unknown>>;
    out.connectedAccountsList = items.map(it => ({
      id: it.id,
      status: it.status,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toolkit: (it as any).toolkit?.slug,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authConfigId: (it as any).auth_config?.id ?? (it as any).authConfig?.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userId: (it as any).user_id ?? (it as any).userId,
    }));
  } catch (e) {
    out.connectedAccountsListError = (e as Error).message;
  }

  // 3. tools.get without authConfigs (current fetchOwnerTools behavior)
  try {
    const tools = await composio.tools.get(artistId, { toolkits: ["youtube"], limit: 100 });
    out.toolsGetNoAuthConfig = Object.keys(tools as Record<string, unknown>);
  } catch (e) {
    out.toolsGetNoAuthConfigError = (e as Error).message;
  }

  // 4. tools.get WITH authConfigs (hypothesis: needs the custom OAuth config)
  if (process.env.COMPOSIO_YOUTUBE_AUTH_CONFIG_ID) {
    try {
      const tools = await composio.tools.get(artistId, {
        toolkits: ["youtube"],
        limit: 100,
        authConfigs: { youtube: process.env.COMPOSIO_YOUTUBE_AUTH_CONFIG_ID },
      } as never);
      out.toolsGetWithAuthConfig = Object.keys(tools as Record<string, unknown>);
    } catch (e) {
      out.toolsGetWithAuthConfigError = (e as Error).message;
    }
  }

  return NextResponse.json(out);
}
