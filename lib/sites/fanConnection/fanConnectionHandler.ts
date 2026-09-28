import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { selectSite } from "@/lib/supabase/sites/selectSite";
import { selectFanConfig } from "@/lib/supabase/site_fan_connections/selectFanConfig";
import { updateFanConfig } from "@/lib/supabase/site_fan_connections/updateFanConfig";
import { selectSiteFans } from "@/lib/supabase/site_fan_connections/selectSiteFans";
import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import { SiteError } from "../SiteError";
import { configInputSchema, fanQuerySchema } from "./schema";
import { getFanOAuthConfig } from "./getFanOAuthConfig";
import { requireFanEntitlement } from "./requireFanEntitlement";
/** Authenticated agent API; site ownership comes from the credential, never public input. */
export async function fanConnectionHandler(
  request: NextRequest,
  id: string,
  operation: "get" | "configure" | "fans",
) {
  const auth = await validateAuthContext(request);
  if (auth instanceof NextResponse) return auth;
  const headers = { "Cache-Control": "private, no-store" };
  try {
    z.string().uuid().parse(id);
    const site = await selectSite(id);
    if (!site) throw new SiteError(404, "Site not found");
    await authorizeSiteWorkspace(auth.accountId, site.owner_id);
    if (operation === "fans") {
      const query = fanQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
      return NextResponse.json(await selectSiteFans(id, query.offset, query.limit), { headers });
    }
    let config = await selectFanConfig(id);
    if (operation === "configure") {
      const input = configInputSchema.parse(await request.json());
      if (input.enabled) {
        if (!site.artist_id)
          throw new SiteError(400, "Assign an artist to the site before enabling fan connection");
        getFanOAuthConfig();
        await requireFanEntitlement(site.owner_id);
      }
      config = await updateFanConfig(
        {
          site_id: id,
          return_url: input.returnUrl,
          marketing_text: input.marketingText,
          enabled: input.enabled,
          revision: input.revision + 1,
        },
        input.revision,
      );
    }
    const connectUrl = config?.enabled
      ? `${getFanOAuthConfig().origin}/api/sites/public/${id}/spotify`
      : null;
    return NextResponse.json(
      { siteId: id, ownerId: site.owner_id, artistId: site.artist_id, config, connectUrl },
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof SiteError
            ? error.message
            : error instanceof ZodError
              ? "Invalid fan connection input"
              : "Could not finish fan connection action",
      },
      {
        status:
          error instanceof SiteError
            ? error.status
            : error instanceof ZodError || error instanceof SyntaxError
              ? 400
              : 503,
        headers,
      },
    );
  }
}
