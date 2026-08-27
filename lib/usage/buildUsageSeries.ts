import { formatCentsAsUsd } from "@/lib/credits/formatCentsAsUsd";
import type { SeriesBucket } from "@/lib/usage/seriesBucket";
import { truncateToBucket } from "@/lib/usage/truncateToBucket";

export interface UsageSeriesPoint {
  /** Bucket start, ISO 8601 UTC. */
  start: string;
  /** Sum of the bucket's charges, in credits (micro-dollars). */
  credits_deducted: number;
  /** The same sum as a USD string. */
  usd: string;
  /** Number of charges in the bucket. */
  events: number;
}

/**
 * Spend per bucket over the rows of a period, ascending by bucket start.
 * Only buckets with at least one charge are present; clients fill the gaps.
 *
 * @param rows - Every charge of the period.
 * @param bucket - The bucket size.
 * @returns One point per non-empty bucket, oldest first.
 */
export function buildUsageSeries(
  rows: ReadonlyArray<{ created_at: string; credits_deducted: number }>,
  bucket: SeriesBucket,
): UsageSeriesPoint[] {
  const sums = new Map<string, { credits_deducted: number; events: number }>();
  for (const row of rows) {
    const start = truncateToBucket(row.created_at, bucket);
    const point = sums.get(start) ?? { credits_deducted: 0, events: 0 };
    point.credits_deducted += row.credits_deducted;
    point.events += 1;
    sums.set(start, point);
  }
  return [...sums.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([start, point]) => ({ start, ...point, usd: formatCentsAsUsd(point.credits_deducted) }));
}
