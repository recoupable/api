import supabase from "../serverClient";

/**
 * Delete a task and, by cascade, its comments. Scoped to the project for the
 * same reason as the update.
 *
 * @returns Whether a row was deleted.
 */
export async function deleteProjectTask(projectId: string, taskId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("project_tasks")
    .delete()
    .eq("project_id", projectId)
    .eq("id", taskId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Failed to delete project_tasks: ${error.message}`);
  return Boolean(data);
}
