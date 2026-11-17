import { returnUrlSchema } from "./schema";
/** Shared precedence and validation for preparing or requiring a fan destination. */
export function resolveSiteFanReturnUrl(
  siteId: string,
  configuredUrl?: string,
  returnUrl?: string,
) {
  return returnUrlSchema.parse(
    returnUrl ??
      configuredUrl ??
      `${process.env.SITES_PUBLIC_ORIGIN || "https://app.recoupable.dev"}/s/${siteId}`,
  );
}
