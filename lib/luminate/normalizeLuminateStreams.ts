import { createHash } from "node:crypto";
import { z } from "zod";

export const luminateStreamRequestSchema = z
  .object({
    isrc: z.string().regex(/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/),
    since: z.iso.date(),
    until: z.iso.date(),
  })
  .strict()
  .refine(p => p.until >= p.since && Date.parse(p.until) - Date.parse(p.since) <= 61 * 86400000);
export type LuminateStreamRequest = z.infer<typeof luminateStreamRequestSchema>;

/** Validate source identity and daily aggregate scope; omitted dates remain missing. */
export function normalizeLuminateStreams(payload: unknown, input: LuminateStreamRequest) {
  const request = luminateStreamRequestSchema.parse(input);
  const value = z
    .object({
      id: z.string().min(1),
      isrc: z.union([z.string(), z.array(z.string())]),
      location: z.literal("AA"),
      start_date: z.literal(request.since),
      end_date: z.literal(request.until),
      metrics: z.array(z.object({ name: z.string(), value: z.unknown() })),
    })
    .parse(payload);
  if (!(Array.isArray(value.isrc) ? value.isrc : [value.isrc]).includes(request.isrc))
    throw new Error("Luminate recording identity mismatch");
  const metrics = value.metrics.filter(m => m.name === "Streams");
  if (metrics.length !== 1) throw new Error("Luminate daily streams unavailable");
  const totals = z
    .array(z.object({ name: z.string(), value: z.unknown() }))
    .parse(metrics[0].value)
    .filter(m => m.name === "total");
  if (totals.length !== 1) throw new Error("Luminate daily aggregate unavailable");
  const daily = z
    .array(
      z.object({
        date: z.iso.date(),
        value: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      }),
    )
    .max(62)
    .parse(totals[0].value);
  const seen = new Set<string>();
  for (const day of daily) {
    if (seen.has(day.date) || day.date < request.since || day.date > request.until)
      throw new Error("Invalid Luminate observation dates");
    seen.add(day.date);
  }
  return {
    provider_recording_id: value.id,
    source_hash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
    days: daily
      .map(day => ({ date: day.date, streams: day.value }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
