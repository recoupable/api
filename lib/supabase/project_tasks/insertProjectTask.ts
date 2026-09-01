import supabase from "../serverClient";
import { Tables, TablesInsert } from "@/types/database.types";

/** Create a task on a project. */
export async function insertProjectTask(
  task: TablesInsert<"project_tasks">,
): Promise<Tables<"project_tasks">> {
  const { data, error } = await supabase.from("project_tasks").insert(task).select("*").single();

  if (error) throw new Error(`Failed to insert project_tasks: ${error.message}`);
  return data;
}
