import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { consumeFanSession } from "@/lib/supabase/site_fan_connections/consumeFanSession";
import { completeFanConnection } from "@/lib/supabase/site_fan_connections/completeFanConnection";
import { selectSite } from "@/lib/supabase/sites/selectSite";
import { selectFanConfig } from "@/lib/supabase/site_fan_connections/selectFanConfig";
import { getFanOAuthConfig } from "./getFanOAuthConfig";
import { hashFanValue } from "./hashFanValue";
import { requireFanEntitlement } from "./requireFanEntitlement";
/** Provider-confirmed identity and scopes only. No access token ever reaches the external site. */
export async function finishFanConnection(request: NextRequest) {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  let returnUrl: URL | undefined;
  let cookieName: string | undefined;
  let outcome = "failed";
  try {
    const state = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(request.nextUrl.searchParams.get("state"));
    const stateHash = hashFanValue(state);
    cookieName = `__Host-recoup-fan-${stateHash.slice(0, 16)}`;
    const browser = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(request.cookies.get(cookieName)?.value);
    const session = await consumeFanSession(stateHash, hashFanValue(browser));
    if (!session) throw new Error("Invalid connection session");
    const site = await selectSite(session.site_id);
    const config = await selectFanConfig(session.site_id);
    if (!site?.artist_id || !config?.enabled || config.revision !== session.config_revision)
      throw new Error("Connection settings changed");
    returnUrl = new URL(session.return_url);
    if (request.nextUrl.searchParams.has("error")) outcome = "cancelled";
    else {
      await requireFanEntitlement(site.owner_id);
      const code = z.string().min(1).max(2048).parse(request.nextUrl.searchParams.get("code"));
      const oauth = getFanOAuthConfig();
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: oauth.clientId,
          code,
          redirect_uri: oauth.callback,
          code_verifier: session.verifier,
        }),
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Spotify authorization failed");
      const token = z
        .object({ access_token: z.string().min(1), scope: z.string() })
        .parse(await response.json());
      const scopes = [...new Set(token.scope.split(/\s+/).filter(Boolean))];
      if (!session.scopes.every(scope => scopes.includes(scope)))
        throw new Error("Missing requested permissions");
      const profileResponse = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });
      if (!profileResponse.ok) throw new Error("Spotify profile unavailable");
      const profile = z
        .object({
          id: z.string().min(1).max(255),
          display_name: z.string().max(255).nullish(),
          email: z.string().email().max(254).nullish(),
        })
        .parse(await profileResponse.json());
      await completeFanConnection({
        stateHash,
        spotifyId: profile.id,
        displayName: profile.display_name ?? null,
        email: profile.email ?? null,
        scopes,
      });
      outcome = "connected";
    }
  } catch {
    console.error("[sites:fan-connection] Callback failed; no fan connection confirmed");
  }
  const response = returnUrl
    ? (() => {
        returnUrl!.searchParams.set("recoup_spotify", outcome);
        return NextResponse.redirect(returnUrl!, 303);
      })()
    : new NextResponse(
        "This connection expired or is invalid. Return to the site and connect again.",
        { status: 400 },
      );
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  if (cookieName)
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  return response;
}
