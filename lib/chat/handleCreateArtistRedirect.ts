import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart, type UIMessage } from "ai";
import { copyChatMessages } from "@/lib/chats/copyChatMessages";
import { copyRoom } from "@/lib/rooms/copyRoom";
import type { ChatRequestBody } from "./validateChatRequest";
import type { CreateNewArtistResult } from "@/lib/mcp/tools/artists/registerCreateNewArtistTool";

function getCreateArtistResult(responseMessages: UIMessage[]): CreateNewArtistResult | null {
  for (const message of responseMessages) {
    for (const part of message.parts) {
      if (!isToolOrDynamicToolUIPart(part)) continue;
      if (getToolOrDynamicToolName(part) !== "create_new_artist") continue;
      if (part.state !== "output-available") continue;

      if (part.type === "dynamic-tool") {
        const text = (part.output as { content?: Array<{ text?: string }> } | undefined)
          ?.content?.[0]?.text;
        if (!text) continue;

        try {
          return JSON.parse(text) as CreateNewArtistResult;
        } catch {
          continue;
        }
      }

      return part.output as CreateNewArtistResult;
    }
  }

  return null;
}

export async function handleCreateArtistRedirect(
  body: ChatRequestBody,
  responseMessages: UIMessage[],
): Promise<string | undefined> {
  const createArtistResult = getCreateArtistResult(responseMessages);
  if (!createArtistResult?.artistAccountId) {
    return undefined;
  }

  const newRoomId = await copyRoom(body.roomId ?? "", createArtistResult.artistAccountId);
  if (!newRoomId) {
    console.error("Failed to create final artist conversation room");
    return undefined;
  }

  const copyResult = await copyChatMessages({
    sourceChatId: body.roomId ?? "",
    targetChatId: newRoomId,
    clearExisting: true,
  });
  if (copyResult.status === "error") {
    console.error(copyResult.error);
    return undefined;
  }

  return `/chat/${newRoomId}`;
}
