import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { selectFanConfig } from "@/lib/supabase/site_fan_connections/selectFanConfig";
import { updateFanConfig } from "@/lib/supabase/site_fan_connections/updateFanConfig";
import { hasPaidSiteSubscription } from "./hasPaidSiteSubscription";
import { getFanOAuthConfig } from "./getFanOAuthConfig";
import { returnUrlSchema } from "./schema";
import { SiteError } from "../SiteError";
/** Called only after workspace authorization, before making a draft public. */
export async function prepareSiteFanConnection(
  site: { id: string; owner_id: string; artist_id: string | null },
  returnUrl?: string,
) {
  if (!(await hasPaidSiteSubscription(site.owner_id))) return "subscription-required" as const;
  getFanOAuthConfig();
  if (!site.artist_id)
    throw new SiteError(
      400,
      "Choose an artist for this site before publishing so Spotify fans are attributed correctly.",
    );
  const config = await selectFanConfig(site.id);
  const destination = returnUrlSchema.parse(
    returnUrl ??
      config?.return_url ??
      `${process.env.SITES_PUBLIC_ORIGIN || "https://app.recoupable.dev"}/s/${site.id}`,
  );
  if (config?.enabled && config.return_url === destination) return "enabled" as const;
  const [artist] = await selectAccounts(site.artist_id);
  if (!artist?.name?.trim()) throw new SiteError(400, "Add the artist's name before publishing.");
  await updateFanConfig(
    {
      site_id: site.id,
      return_url: destination,
      enabled: true,
      revision: (config?.revision ?? 0) + 1,
      marketing_text:
        config?.marketing_text ||
        `I agree to receive release announcements and offers by email from ${artist.name.trim()}.`,
    },
    config?.revision ?? 0,
  );
  return "enabled" as const;
}
