import selectMemories from "@/lib/supabase/memories/selectMemories";
import deleteMemories from "@/lib/supabase/memories/deleteMemories";
import insertMemories from "@/lib/supabase/memories/insertMemories";
import { generateUUID } from "@/lib/uuid/generateUUID";

type CopyChatMessagesParams = {
  sourceChatId: string;
  targetChatId: string;
  clearExisting?: boolean;
};

export type CopyChatMessagesResult =
  | {
      status: "success";
      copiedCount: number;
      clearedExisting: boolean;
    }
  | {
      status: "error";
      error: string;
    };

export async function copyChatMessages({
  sourceChatId,
  targetChatId,
  clearExisting = true,
}: CopyChatMessagesParams): Promise<CopyChatMessagesResult> {
  const sourceMemories = await selectMemories(sourceChatId, { ascending: true });
  if (!sourceMemories) {
    return { status: "error", error: "Failed to load source chat messages" };
  }

  if (clearExisting) {
    const deleted = await deleteMemories(targetChatId);
    if (!deleted) {
      return { status: "error", error: "Failed to clear target chat messages" };
    }
  }

  const copiedCount = await insertMemories(
    sourceMemories.map(memory => ({
      id: generateUUID(),
      room_id: targetChatId,
      content: memory.content,
      updated_at: memory.updated_at,
    })),
  );

  return {
    status: "success",
    copiedCount,
    clearedExisting: clearExisting,
  };
}
