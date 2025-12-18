import supabase from "../serverClient";
import type { Tables, TablesInsert } from "@/types/database.types";

type MemoryEmail = Tables<"memory_emails">;

type InsertMemoryEmailParams = TablesInsert<"memory_emails">;

/**
 * Inserts a new memory_email record to link an email with a memory.
 *
 * @param params - The parameters for the memory_email
 * @param params.email_id - The email ID from Resend
 * @param params.memory - The memory ID
 * @param params.message_id - The message ID from Resend
 * @param params.id - Optional ID for the memory_email record
 * @param params.created_at - Optional created_at timestamp
 * @returns The inserted memory_email record
 */
export default async function insertMemoryEmail(
  params: InsertMemoryEmailParams,
): Promise<MemoryEmail> {
  const { data, error } = await supabase.from("memory_emails").insert(params).select().single();

  if (error) {
    console.error("Error creating memory_email:", error);
    throw error;
  }

  return data;
}
