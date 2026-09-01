import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * A project's tasks, oldest first.
 *
 * created_at is the sort key: the timeline is authored in order and there is no
 * sort_order column to disagree with it. Secondary sort on id keeps two tasks
 * created in the same millisecond stable.
 */
export async function selectProjectTasks(projectId: string): Promise<Tables<"project_tasks">[]> {
  const { data, error } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(`Failed to fetch project_tasks: ${error.message}`);
  return data ?? [];
}
