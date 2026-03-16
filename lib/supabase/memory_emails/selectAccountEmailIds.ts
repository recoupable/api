import supabase from "../serverClient";
import { selectRooms } from "@/lib/supabase/rooms/selectRooms";

export interface AccountEmailIdRow {
  email_id: string;
  created_at: string;
}

/**
 * Returns Resend email IDs for all emails sent for a given account,
 * by joining rooms → memories → memory_emails.
 *
 * @param accountId - The account ID to look up emails for
 * @returns Array of { email_id, created_at } sorted by created_at desc
 */
export async function selectAccountEmailIds(
  accountId: string,
): Promise<AccountEmailIdRow[]> {
  const rooms = await selectRooms({ account_ids: [accountId] });
  if (!rooms || rooms.length === 0) return [];

  const roomIds = rooms.map((r) => r.id);

  const { data: memories, error: memoriesError } = await supabase
    .from("memories")
    .select("id")
    .in("room_id", roomIds);

  if (memoriesError || !memories || memories.length === 0) return [];

  const memoryIds = memories.map((m) => m.id);

  const { data: emailRows, error: emailError } = await supabase
    .from("memory_emails")
    .select("email_id, created_at")
    .in("memory", memoryIds)
    .order("created_at", { ascending: false });

  if (emailError || !emailRows) return [];

  return emailRows as AccountEmailIdRow[];
}
