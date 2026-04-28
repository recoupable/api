/**
 * Returns true if `raw` parses as an absolute http(s) URL whose host is
 * not loopback, link-local, RFC1918 private, CGNAT, multicast, broadcast,
 * or an IPv4-mapped IPv6 form. Used to gate outbound fetches against
 * SSRF via untrusted user-supplied URLs.
 *
 * NOTE: this is a parse-time check. It does not protect against DNS
 * rebinding — if you accept fully untrusted hostnames, also resolve
 * the host and re-check the resolved IP at fetch time.
 */
export function isSafeHttpUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  // URL.hostname brackets IPv6 literals (`[::1]`) — strip them so the
  // textual checks below can match the raw IPv6 form.
  let host = parsed.hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  if (!host) return false;

  if (host === "localhost" || host.endsWith(".localhost")) return false;

  // IPv4 private / loopback / link-local / CGNAT / multicast / reserved / broadcast.
  if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return false; // 100.64.0.0/10
  if (/^(22[4-9]|23\d|24\d|25[0-5])\./.test(host)) return false; // 224.0.0.0/4 + 240.0.0.0/4
  if (host === "255.255.255.255") return false;

  // IPv6 loopback / unique-local / link-local. Also block all
  // IPv4-mapped IPv6 (`::ffff:*`) — it's almost always a bypass attempt
  // and a legitimate caller would just use the IPv4 form directly.
  if (host === "::1" || host === "::") return false;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return false; // fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(host)) return false; // fe80::/10
  if (host.startsWith("::ffff:")) return false;

  return true;
}
