import { nanoid } from "nanoid";
import serverClient from "../serverClient";
import { Tables, TablesInsert } from "@/types/database.types";

export type UsageEvent = Tables<"usage_events">;

/**
 * Inserts a usage_events row. The `id` is generated server-side via nanoid
 * to match open-agents' write path (apps/web/lib/db/usage.ts).
 */
export const insertUsageEvent = async (
  event: Omit<TablesInsert<"usage_events">, "id">,
): Promise<UsageEvent> => {
  const { data, error } = await serverClient
    .from("usage_events")
    .insert({ ...event, id: nanoid() })
    .select()
    .single();

  if (error) {
    console.error("Error inserting usage_events row:", error);
    throw error;
  }

  return data;
};
