import supabase from "../serverClient";
import { Tables } from "@/types/database.types";

/**
 * One task, scoped to its project.
 *
 * Both ids are matched so a task id from another project cannot be read through
 * a project the caller does happen to collaborate on.
 */
export async function selectProjectTask(
  projectId: string,
  taskId: string,
): Promise<Tables<"project_tasks"> | null> {
  const { data, error } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch project_tasks: ${error.message}`);
  return data;
}
