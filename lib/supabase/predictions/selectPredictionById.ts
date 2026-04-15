import supabase from "../serverClient";

interface PredictionRow {
  id: string;
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
  created_at: string;
}

/**
 * Selects a single prediction by its UUID.
 *
 * @param id - The prediction UUID.
 * @returns The full prediction row, or null if not found.
 */
export async function selectPredictionById(id: string): Promise<PredictionRow | null> {
  const { data, error } = await supabase
    .from("predictions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to select prediction: ${error.message}`);
  }

  return data as PredictionRow | null;
}
