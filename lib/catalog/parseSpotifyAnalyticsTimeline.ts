import { createHash } from "node:crypto";

const AUDIENCE_HEADER =
  "date,listeners,monthly listeners,monthly active listeners,super listeners,streams,playlist adds,saves,followers";

/**
 * Parse the two verified native Spotify for Artists timeline schemas.
 * Extracts daily streams only; IDs, scope, retrieval time and access require a separate manifest.
 * Does not infer missing dates, recording membership, source freshness or rights.
 */
export function parseSpotifyAnalyticsTimeline(csv: string) {
  if (typeof csv !== "string" || Buffer.byteLength(csv, "utf8") > 250_000) {
    throw new Error("Unsupported timeline size (maximum 250 KB)");
  }
  const lines = csv
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split(/\r?\n/);
  if (lines.length < 2 || lines.length > 4_001) throw new Error("Expected 1–4000 daily rows");
  // These numeric timeline schemas have no embedded commas/newlines. Reject other dialects.
  const fields = (line: string) =>
    line.split(",").map(field => {
      const value = field.replace(/^"([^"\r\n]*)"$/, "$1");
      if (value.includes('"') || value.includes("\r")) throw new Error("Unsupported CSV field");
      return value;
    });
  const header = fields(lines[0]).join(",");
  if (header !== "date,streams" && header !== AUDIENCE_HEADER) {
    throw new Error("Unsupported Spotify timeline schema; export a song or audience timeline");
  }
  const song = header === "date,streams";
  const seen = new Set<string>();
  const dailyStreams = lines.slice(1).map(line => {
    const values = fields(line);
    if (values.length !== (song ? 2 : 9)) throw new Error("Invalid timeline column count");
    const date = values[0];
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== date
    )
      throw new Error("Invalid timeline UTC date");
    if (seen.has(date)) throw new Error("Duplicate timeline date; keep export versions separate");
    seen.add(date);
    const rawStreams = values[song ? 1 : 5];
    const streams = Number(rawStreams);
    if (!/^\d+$/.test(rawStreams) || !Number.isSafeInteger(streams)) {
      throw new Error("Expected an exact nonnegative safe integer stream count");
    }
    return { date, streams };
  });
  return {
    format: song ? ("song_timeline" as const) : ("audience_timeline" as const),
    content_sha256: createHash("sha256").update(csv, "utf8").digest("hex"),
    daily_streams: dailyStreams.sort((a, b) => a.date.localeCompare(b.date)),
  };
}
