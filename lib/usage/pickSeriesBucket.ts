import type { SeriesBucket } from "@/lib/usage/seriesBucket";

const DAY_MS = 86_400_000;

/**
 * Bucket for a spend series over `[from, to)`: hours up to two days, days up
 * to 90 days, weeks up to twelve months (366 days), months beyond. Clients
 * never choose it; the span implies it.
 *
 * @param from - Period start, ISO 8601.
 * @param to - Period end, ISO 8601.
 * @returns The bucket the series is reported in.
 */
export function pickSeriesBucket(from: string, to: string): SeriesBucket {
  const days = (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;
  if (days <= 2) return "hour";
  if (days <= 90) return "day";
  if (days <= 366) return "week";
  return "month";
}
