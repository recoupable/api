import { z } from "zod";
/** Source lookup only. Caller MUST acquire a shared provider rate-limit permit (at most 1 request/second). */
export async function lookupMusicBrainzIsrc(
  input: string,
  acquirePermit: () => Promise<void>,
  fetcher: typeof fetch = fetch,
) {
  const isrc = z
    .string()
    .regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/)
    .parse(input.replace(/-/g, "").toUpperCase());
  const url = `https://musicbrainz.org/ws/2/isrc/${isrc}?fmt=json&inc=artist-credits+releases`;
  await acquirePermit();
  const startedAt = new Date().toISOString(),
    start = Date.now();
  const response = await fetcher(url, {
    headers: {
      "User-Agent": "RecoupContextEngine/1.0 (https://recoupable.dev; agent@recoupable.dev)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  const trace = {
    sourceUrl: url,
    startedAt,
    httpStatus: response.status,
    elapsedMs: Date.now() - start,
  };
  if (response.status === 404) return { status: "not_found", recordings: [], trace };
  if (!response.ok)
    throw new Error(
      `MusicBrainz HTTP ${response.status}; retry-after=${response.headers.get("retry-after") ?? "unknown"}`,
    );
  const raw = await response.json();
  const data = z
    .object({
      isrc: z.string(),
      recordings: z.array(z.object({ id: z.string().min(1), title: z.string() }).passthrough()),
    })
    .passthrough()
    .parse(raw);
  if (data.isrc !== isrc) throw new Error("MusicBrainz returned a different ISRC");
  return {
    status:
      data.recordings.length > 1
        ? "needs_review"
        : data.recordings.length
          ? "candidate_found"
          : "not_found",
    recordings: data.recordings,
    trace: { ...trace, elapsedMs: Date.now() - start, rawResponse: raw },
    limitations: [
      "Community-sourced candidates; identity and rights are not automatically confirmed.",
      "Included release lists may be limited; follow-up browsing is separate.",
    ],
  };
}
