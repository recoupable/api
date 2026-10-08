/** Give the provider a conservative freshness lifetime; never serve stale metadata. */
export function getOAuthMetadataCacheControl(headers: Headers): string {
  const control = headers.get("cache-control") ?? "";
  // Split only outside quoted extension values; malformed or duplicate directives fail closed.
  const parts: string[] = [];
  let part = "";
  let quoted = false;
  let escaped = false;
  for (const character of control) {
    if (escaped) escaped = false;
    else if (quoted && character === "\\") escaped = true;
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      parts.push(part);
      part = "";
      continue;
    }
    part += character;
  }
  if (quoted || escaped) return "max-age=0";
  parts.push(part);
  const directives = new Map<string, string>();
  for (const value of parts) {
    if (!value.trim()) continue;
    const separator = value.indexOf("=");
    const key = (separator < 0 ? value : value.slice(0, separator)).trim().toLowerCase();
    if (directives.has(key)) return "max-age=0";
    directives.set(key, separator < 0 ? "" : value.slice(separator + 1).trim());
  }
  if (directives.has("no-store") || directives.has("no-cache")) return "max-age=0";
  const duration = directives.get("s-maxage") ?? directives.get("max-age");
  const match = duration?.match(/^(?:"(\d+)"|(\d+))$/);
  if (duration !== undefined && !match) return "max-age=0";
  const age = Number(headers.get("age") ?? 0);
  const date = Date.parse(headers.get("date") ?? "");
  const apparentAge = Number.isFinite(date) ? Math.max(0, (Date.now() - date) / 1000) : 0;
  const expires = Date.parse(headers.get("expires") ?? "");
  const ttl = match
    ? Number(match[1] ?? match[2])
    : Number.isFinite(expires)
      ? (expires - (Number.isFinite(date) ? date : Date.now())) / 1000
      : 0;
  const remaining = ttl - Math.max(Number.isFinite(age) && age >= 0 ? age : ttl, apparentAge);
  return `max-age=${Math.max(0, Math.min(300, Math.floor(remaining)))}`;
}
