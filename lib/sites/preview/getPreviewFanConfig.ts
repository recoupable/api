import { authorizeSiteWorkspace } from "../authorizeSiteWorkspace";
import type { Site } from "../schema";
import { verifySitePreview } from "./verifySitePreview";
/** The signed preview marker persists in the existing OAuth session return URL. */
export async function getPreviewFanConfig(site: Site, token: string) {
  const grant = verifySitePreview(token, site.id);
  await authorizeSiteWorkspace(grant.accountId, site.owner_id);
  const returnUrl = new URL(
    `/sites/${site.id}`,
    process.env.SITES_PUBLIC_ORIGIN || "https://app.recoupable.dev",
  );
  returnUrl.searchParams.set("recoup_preview", token);
  return {
    site_id: site.id,
    enabled: true,
    revision: 0,
    return_url: returnUrl.href,
    marketing_text:
      "This is a private preview. Connecting verifies your Spotify profile and available email. You will not be added to the artist’s marketing audience.",
  };
}
