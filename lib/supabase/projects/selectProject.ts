import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/** One project by id, or null when it does not exist. */
export async function selectProject(projectId: string): Promise<Tables<"projects"> | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch projects: ${error.message}`);
  return data;
}
