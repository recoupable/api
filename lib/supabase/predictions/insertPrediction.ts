import supabase from "../serverClient";

interface PredictionInsert {
  account_id: string;
  file_url: string;
  modality: string;
  engagement_score: number;
  engagement_timeline: unknown;
  peak_moments: unknown;
  weak_spots: unknown;
  regional_activation: unknown;
  total_duration_seconds: number;
  elapsed_seconds: number;
}

interface PredictionRow extends PredictionInsert {
  id: string;
  created_at: string;
}

/**
 * Inserts a new prediction row after TRIBE v2 returns results.
 *
 * @param prediction - The prediction data to insert.
 * @returns The inserted prediction row with id and created_at.
 * @throws Error if the insert fails.
 */
export async function insertPrediction(prediction: PredictionInsert): Promise<PredictionRow> {
  const { data, error } = await supabase
    .from("predictions")
    .insert(prediction)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert prediction: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to insert prediction: No data returned");
  }

  return data as PredictionRow;
}
