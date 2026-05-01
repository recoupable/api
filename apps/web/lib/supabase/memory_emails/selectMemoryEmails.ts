import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

type MemoryEmail = Tables<"memory_emails">;
type Memory = Tables<"memories">;

export type MemoryEmailWithMemory = MemoryEmail & {
  memories: Memory | null;
};

interface SelectMemoryEmailsParams {
  messageIds: string[];
}

/**
 * Selects memory_emails by message IDs, joined with the memories table.
 *
 * @param params - The parameters for the query
 * @param params.messageIds - Array of message IDs to query
 * @returns Array of memory_emails rows with joined memory data
 */
export default async function selectMemoryEmails({
  messageIds,
}: SelectMemoryEmailsParams): Promise<MemoryEmailWithMemory[]> {
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("memory_emails")
    .select("*, memories(*)")
    .in("message_id", messageIds);

  if (error) {
    console.error("Error fetching memory_emails:", error);
    return [];
  }

  if (!data) {
    return [];
  }

  return data;
}
