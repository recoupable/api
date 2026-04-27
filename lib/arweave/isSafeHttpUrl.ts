/**
 * Returns true if `raw` parses as an absolute http(s) URL whose host is
 * not loopback, link-local, or RFC1918 private. Used to gate outbound
 * fetches against SSRF via untrusted user-supplied URLs.
 */
export function isSafeHttpUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (
    /^(10\.|127\.|0\.|169\.254\.|192\.168\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    return false;
  }
  return true;
}
