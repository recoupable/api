/** Give the provider a conservative freshness lifetime; never serve stale metadata. */
export function getOAuthMetadataCacheControl(headers: Headers): string {
  const control = headers.get("cache-control") ?? "";
  if (/(?:^|,)\s*(no-store|no-cache)\b/i.test(control)) return "max-age=0";
  const match = /(?:^|,)\s*max-age\s*=\s*"?(\d+)"?(?:\s*,|\s*$)/i.exec(control);
  const age = Number(headers.get("age") ?? 0);
  const date = Date.parse(headers.get("date") ?? "");
  const apparentAge = Number.isFinite(date) ? Math.max(0, (Date.now() - date) / 1000) : 0;
  const expires = Date.parse(headers.get("expires") ?? "");
  const ttl = match
    ? Number(match[1])
    : Number.isFinite(expires)
      ? (expires - (Number.isFinite(date) ? date : Date.now())) / 1000
      : 0;
  const remaining = ttl - Math.max(Number.isFinite(age) && age >= 0 ? age : ttl, apparentAge);
  return `max-age=${Math.max(0, Math.min(300, Math.floor(remaining)))}`;
}
