import { isIP } from "node:net";
import { isPublicOAuthAddress } from "./isPublicOAuthAddress";

/** Restrict outbound OAuth metadata to public HTTPS on the standard TLS port. */
export function validateOAuthMetadataUrl(input: string): URL {
  const url = new URL(input);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const rawPath = input.replace(/^https:\/\/[^/]+/i, "").split(/[?#]/)[0];
  if (
    !/^https:\/\//i.test(input) ||
    /[\x00-\x20\x7f\\]/.test(input) ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    input.includes("#") ||
    (url.port && url.port !== "443") ||
    rawPath.split("/").some(segment => /^(\.|\.\.)$/.test(segment.replace(/%2e/gi, "."))) ||
    (!hostname.includes(".") && !isIP(hostname)) ||
    /(^|\.)(localhost|local|internal|home|test|invalid|onion)\.?$/i.test(hostname) ||
    (isIP(hostname) && !isPublicOAuthAddress(hostname))
  )
    throw new Error("Unsafe OAuth metadata URL");
  return url;
}
