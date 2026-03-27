import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select a slack installation by slack_team_id.
 * Used in artist resolution to find the linked organization.
 *
 * @param slackTeamId - The Slack workspace team ID
 * @returns The matching slack installation, or null if not found
 */
export async function selectSlackInstallationByTeamId(
  slackTeamId: string,
): Promise<Tables<"slack_installations"> | null> {
  const { data, error } = await supabase
    .from("slack_installations")
    .select("*")
    .eq("slack_team_id", slackTeamId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}
