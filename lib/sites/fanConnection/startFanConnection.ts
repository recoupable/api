import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { selectSite } from "@/lib/supabase/sites/selectSite";
import { selectFanConfig } from "@/lib/supabase/site_fan_connections/selectFanConfig";
import { insertFanSession } from "@/lib/supabase/site_fan_connections/insertFanSession";
import { SiteError } from "../SiteError";
import { getFanOAuthConfig } from "./getFanOAuthConfig";
import { hashFanValue } from "./hashFanValue";
import { requireFanEntitlement } from "./requireFanEntitlement";
import { renderFanConnectPage } from "./renderFanConnectPage";
/** Hosted entry works as a top-level link on any registered external site; no browser API key. */
export async function startFanConnection(request: NextRequest, id: string) {
  const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  };
  try {
    z.string().uuid().parse(id);
    const oauth = getFanOAuthConfig();
    const site = await selectSite(id);
    const config = await selectFanConfig(id);
    if (!site?.artist_id || !config?.enabled)
      throw new SiteError(404, "This fan connection is unavailable");
    await requireFanEntitlement(site.owner_id);
    const csrfName = `__Host-recoup-fan-form-${id}`;
    if (request.method === "GET") {
      const csrf = randomBytes(32).toString("hex");
      const response = new NextResponse(
        renderFanConnectPage({
          name: site.name,
          returnUrl: config.return_url,
          marketingText: config.marketing_text,
          revision: config.revision,
          csrf,
        }),
        { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } },
      );
      response.cookies.set(csrfName, csrf, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
      return response;
    }
    if (request.headers.get("origin") !== oauth.origin)
      throw new SiteError(403, "Open the connection page to continue");
    const form = z
      .object({
        csrf: z.string().regex(/^[a-f0-9]{64}$/),
        accept: z.literal("yes"),
        revision: z.coerce.number().int(),
      })
      .strict()
      .parse(Object.fromEntries(await request.formData()));
    if (form.csrf !== request.cookies.get(csrfName)?.value)
      throw new SiteError(403, "Connection page expired. Open it again.");
    if (form.revision !== config.revision)
      throw new SiteError(409, "Connection details changed. Reload and review them.");
    const state = randomBytes(32).toString("hex");
    const browser = randomBytes(32).toString("hex");
    const verifier = randomBytes(48).toString("base64url");
    const stateHash = hashFanValue(state);
    await insertFanSession({
      state_hash: stateHash,
      site_id: id,
      browser_hash: hashFanValue(browser),
      verifier,
      return_url: config.return_url,
      marketing_text: config.marketing_text,
      config_revision: config.revision,
      scopes: oauth.scopes,
      expires_at: new Date(Date.now() + 600000).toISOString(),
    });
    const authorize = new URL("https://accounts.spotify.com/authorize");
    authorize.search = new URLSearchParams({
      client_id: oauth.clientId,
      response_type: "code",
      redirect_uri: oauth.callback,
      state,
      code_challenge_method: "S256",
      code_challenge: Buffer.from(hashFanValue(verifier), "hex").toString("base64url"),
      scope: oauth.scopes.join(" "),
    }).toString();
    const response = NextResponse.redirect(authorize, 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(`__Host-recoup-fan-${stateHash.slice(0, 16)}`, browser, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    response.cookies.set(csrfName, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return new NextResponse(
      error instanceof SiteError
        ? error.message
        : error instanceof ZodError
          ? "Invalid connection request"
          : "Could not start connection. Please return to the site and try again.",
      {
        status: error instanceof SiteError ? error.status : error instanceof ZodError ? 400 : 503,
        headers,
      },
    );
  }
}
