import { selectPlaycountSnapshots } from "@/lib/supabase/playcount_snapshots/selectPlaycountSnapshots";

export type GetMeasurementJobResult = { data: unknown } | { error: string; status: number };

/**
 * Read a `current` measurement job's status from the snapshot job store.
 * `historical` jobs return their enqueue summary in the create response and
 * drain via the daily worker, so they are not polled here.
 *
 * @param params.id - The measurement-job id (a snapshot id)
 * @returns The job status, or a 404 when the id is unknown
 */
export async function getMeasurementJob(params: { id: string }): Promise<GetMeasurementJobResult> {
  const rows = await selectPlaycountSnapshots({ id: params.id });
  const row = rows[0];
  if (!row) return { error: "Unknown measurement-job id", status: 404 };

  return {
    data: {
      status: "success",
      id: row.id,
      source: "current",
      state: row.state,
      album_count: row.album_count,
      estimated_cost_usd: row.estimated_cost_usd,
    },
  };
}
