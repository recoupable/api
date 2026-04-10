import supabase from "../serverClient";

interface PredictionSummary {
  id: string;
  file_url: string;
  modality: string;
  engagement_score: number;
  created_at: string;
}

/**
 * Selects predictions for an account, sorted by creation date descending.
 *
 * @param accountId - The account UUID to filter by.
 * @param limit - Maximum number of rows (default 20, max 100).
 * @param offset - Number of rows to skip (default 0).
 * @returns Array of prediction summaries.
 */
export async function selectPredictions(
  accountId: string,
  limit = 20,
  offset = 0,
): Promise<PredictionSummary[]> {
  const { data, error } = await supabase
    .from("predictions")
    .select("id, file_url, modality, engagement_score, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to select predictions: ${error.message}`);
  }

  return (data ?? []) as PredictionSummary[];
}
