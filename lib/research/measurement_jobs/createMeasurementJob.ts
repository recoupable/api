import { createSnapshot } from "@/lib/research/playcounts/createSnapshot";
import type { ValidatedCreateMeasurementJobRequest } from "./validateCreateMeasurementJobRequest";

export type CreateMeasurementJobResult = { data: unknown } | { error: string; status: number };

type SnapshotData = {
  snapshot_id: string;
  state: string;
  album_count: number;
  estimated_cost_usd: number;
  /** Present only when an existing capture was handed back (chat#1912 row 4). */
  reused?: boolean;
};

/**
 * Create a `current` measurement job: reuses the snapshot capture pipeline
 * (replacing `POST /api/research/snapshots`) and maps `snapshot_id` to the
 * resource's `id`.
 *
 * @param req - The validated create request (accountId + body)
 */
export async function createMeasurementJob(
  req: ValidatedCreateMeasurementJobRequest,
): Promise<CreateMeasurementJobResult> {
  const { accountId, body } = req;

  const result = await createSnapshot({
    accountId,
    body: { ...body.scope, platforms: body.platforms, schedule: "once" },
  });
  if ("error" in result) return result;

  const d = result.data as SnapshotData;
  return {
    data: {
      status: "success",
      source: "current",
      id: d.snapshot_id,
      state: d.state,
      album_count: d.album_count,
      estimated_cost_usd: d.estimated_cost_usd,
      // Surfaced so a caller can tell a handed-back capture from a fresh one
      // without inferring it from the zero cost.
      ...(d.reused ? { reused: true } : {}),
    },
  };
}
