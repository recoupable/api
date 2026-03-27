import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

/**
 * Select a slack installation by id or organization_id.
 *
 * @param params - Either { id } or { organizationId }
 * @returns The matching slack installation, or null if not found
 */
export async function selectSlackInstallation(
  params: { id: string } | { organizationId: string },
): Promise<Tables<"slack_installations"> | null> {
  let query = supabase.from("slack_installations").select("*");

  if ("id" in params) {
    query = query.eq("id", params.id);
  } else {
    query = query.eq("organization_id", params.organizationId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return null;
  }

  return data;
}
