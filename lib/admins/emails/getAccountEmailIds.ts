import { selectRooms } from "@/lib/supabase/rooms/selectRooms";
import { selectMemoryIdsByRoomIds } from "@/lib/supabase/memories/selectMemoryIdsByRoomIds";
import selectMemoryEmails from "@/lib/supabase/memory_emails/selectMemoryEmails";

/**
 * Returns Resend email IDs for all emails sent for a given account
 * by querying rooms → memories → memory_emails.
 *
 * @param accountId - The account ID to look up emails for
 * @returns Array of email_id strings sorted by created_at desc
 */
export async function getAccountEmailIds(
  accountId: string,
): Promise<string[]> {
  const rooms = await selectRooms({ account_ids: [accountId] });
  if (!rooms || rooms.length === 0) return [];

  const roomIds = rooms.map((r) => r.id);
  const memoryIds = await selectMemoryIdsByRoomIds(roomIds);
  if (memoryIds.length === 0) return [];

  const emailRows = await selectMemoryEmails({ memoryIds });

  return emailRows.map((row) => row.email_id);
}
