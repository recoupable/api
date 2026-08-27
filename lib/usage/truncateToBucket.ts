import type { SeriesBucket } from "@/lib/usage/seriesBucket";

/**
 * Start of the bucket a timestamp falls in, in UTC, with the same edges as
 * Postgres `date_trunc` (weeks start on Monday).
 *
 * @param isoTimestamp - Any ISO 8601 timestamp.
 * @param bucket - The bucket size.
 * @returns The bucket start as an ISO string.
 */
export function truncateToBucket(isoTimestamp: string, bucket: SeriesBucket): string {
  const d = new Date(isoTimestamp);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  if (bucket === "hour") return new Date(Date.UTC(y, m, day, d.getUTCHours())).toISOString();
  if (bucket === "day") return new Date(Date.UTC(y, m, day)).toISOString();
  if (bucket === "month") return new Date(Date.UTC(y, m, 1)).toISOString();
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(y, m, day - daysSinceMonday)).toISOString();
}
