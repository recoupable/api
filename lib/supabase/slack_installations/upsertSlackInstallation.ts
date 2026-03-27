import supabase from "../serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

/**
 * Upsert a slack installation, using slack_team_id as the conflict column.
 * If a row with the same slack_team_id exists, it will be updated.
 *
 * @param installation - The slack installation data to upsert
 * @returns The upserted slack installation
 */
export async function upsertSlackInstallation(
  installation: TablesInsert<"slack_installations">,
): Promise<Tables<"slack_installations">> {
  const { data, error } = await supabase
    .from("slack_installations")
    .upsert(installation, { onConflict: "slack_team_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert slack installation: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to upsert slack installation: No data returned");
  }

  return data;
}
