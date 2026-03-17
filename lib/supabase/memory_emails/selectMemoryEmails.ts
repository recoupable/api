import supabase from "../serverClient";
import type { Tables } from "@/types/database.types";

type MemoryEmail = Tables<"memory_emails">;
type Memory = Tables<"memories">;

export type MemoryEmailWithMemory = MemoryEmail & {
  memories: Memory | null;
};

interface SelectMemoryEmailsParams {
  messageIds?: string[];
  memoryIds?: string[];
}

/**
 * Selects memory_emails with optional filters.
 *
 * @param params.messageIds - Filter by message IDs
 * @param params.memoryIds - Filter by memory IDs
 * @returns Array of memory_emails rows with joined memory data
 */
export default async function selectMemoryEmails({
  messageIds,
  memoryIds,
}: SelectMemoryEmailsParams = {}): Promise<MemoryEmailWithMemory[]> {
  const hasMessageIds = Array.isArray(messageIds) && messageIds.length > 0;
  const hasMemoryIds = Array.isArray(memoryIds) && memoryIds.length > 0;

  if (!hasMessageIds && !hasMemoryIds) {
    return [];
  }

  let query = supabase
    .from("memory_emails")
    .select("*, memories(*)")
    .order("created_at", { ascending: false });

  if (hasMessageIds) {
    query = query.in("message_id", messageIds);
  }

  if (hasMemoryIds) {
    query = query.in("memory", memoryIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching memory_emails:", error);
    return [];
  }

  return data ?? [];
}
