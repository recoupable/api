import supabase from "../serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

export type CreateScheduledActionInput = TablesInsert<"scheduled_actions">;

/**
 * Inserts a new scheduled action (task) into the database
 *
 * @param input - The scheduled action data to insert
 * @returns The inserted scheduled actions
 * @throws Error if the insert fails
 */
export async function insertScheduledAction(
  input: CreateScheduledActionInput,
): Promise<Tables<"scheduled_actions">[]> {
  const { data, error } = await supabase.from("scheduled_actions").insert(input).select("*");

  if (error) {
    throw new Error(`Failed to create job: ${error.message}`);
  }

  return data || [];
}
