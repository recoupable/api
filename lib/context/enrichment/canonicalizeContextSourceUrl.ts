const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "yclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref_src",
  "_hsenc",
  "_hsmi",
]);

function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Canonical https URL for story identity. Fragments, credentials and tracking parameters never identify a source. */
export function canonicalizeContextSourceUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; reason: "invalid_url" | "non_https" } {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (parsed.protocol !== "https:") return { ok: false, reason: "non_https" };
  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  const parameters = [...parsed.searchParams.entries()].filter(([key]) => {
    const name = key.toLowerCase();
    return !name.startsWith("utm_") && !TRACKING_PARAMETERS.has(name);
  });
  parameters.sort((a, b) => (a[0] === b[0] ? compare(a[1], b[1]) : compare(a[0], b[0])));
  parsed.search = "";
  for (const [key, value] of parameters) parsed.searchParams.append(key, value);
  return { ok: true, url: parsed.toString() };
}
