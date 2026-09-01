import supabase from "../serverClient";
import { Tables, TablesUpdate } from "@/types/database.types";

/**
 * Update a task, scoped to its project.
 *
 * Both ids are matched so a task id from another project cannot be written
 * through a project the caller does collaborate on. Null when no row matched.
 */
export async function updateProjectTask(
  projectId: string,
  taskId: string,
  updates: TablesUpdate<"project_tasks">,
): Promise<Tables<"project_tasks"> | null> {
  const { data, error } = await supabase
    .from("project_tasks")
    .update(updates)
    .eq("project_id", projectId)
    .eq("id", taskId)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`Failed to update project_tasks: ${error.message}`);
  return data;
}
