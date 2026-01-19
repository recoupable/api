import { UIMessage } from "ai";
import { generateUUID } from "@/lib/uuid/generateUUID";
import { createNewRoom } from "@/lib/chat/createNewRoom";
import insertMemories from "@/lib/supabase/memories/insertMemories";
import filterMessageContentForMemories from "@/lib/messages/filterMessageContentForMemories";

interface SetupConversationParams {
  accountId: string;
  roomId?: string;
  promptMessage: UIMessage;
  artistId?: string;
  memoryId?: string;
}

interface SetupConversationResult {
  roomId: string;
  memoryId: string;
}

/**
 * Sets up a conversation by creating a room (if needed) and persisting the user message.
 *
 * This utility encapsulates the common logic shared between:
 * - validateChatRequest.ts (chat API flow)
 * - validateNewEmailMemory.ts (email inbound flow)
 *
 * @param root0 - The setup conversation parameters
 * @param root0.accountId - The account ID for the conversation
 * @param root0.roomId - Optional existing room ID. If not provided, a new room is created.
 * @param root0.promptMessage - The user's message in UIMessage format
 * @param root0.artistId - Optional artist ID for the room
 * @param root0.memoryId - Optional memory ID. If not provided, a UUID is generated.
 *                          (Email flow uses emailId for deduplication)
 * @returns The final roomId and memoryId used
 * @throws Propagates insertMemories errors (caller can handle duplicates via error code 23505)
 */
export async function setupConversation({
  accountId,
  roomId,
  promptMessage,
  artistId,
  memoryId,
}: SetupConversationParams): Promise<SetupConversationResult> {
  const finalRoomId = roomId || generateUUID();
  const finalMemoryId = memoryId || generateUUID();

  // Create room if roomId was not provided
  if (!roomId) {
    await createNewRoom({
      accountId,
      roomId: finalRoomId,
      artistId,
      lastMessage: promptMessage,
    });
  }

  // Persist user message to memories
  await insertMemories({
    id: finalMemoryId,
    room_id: finalRoomId,
    content: filterMessageContentForMemories(promptMessage),
  });

  return { roomId: finalRoomId, memoryId: finalMemoryId };
}
