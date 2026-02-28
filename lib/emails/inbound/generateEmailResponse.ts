import type { ModelMessage, UserModelMessage } from "ai";
import { marked } from "marked";
import { ChatRequestBody } from "@/lib/chat/validateChatRequest";
import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";
import { getEmailRoomMessages } from "@/lib/emails/inbound/getEmailRoomMessages";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";
import { selectRoomWithArtist } from "@/lib/supabase/rooms/selectRoomWithArtist";

/**
 * Generates the assistant response HTML for an email, including:
 * - Running the general agent to generate a reply for the given room
 * - Appending image attachments as visual content parts to the last user message
 * - Fetching the room messages
 * - Appending a standardized footer with reply and link instructions
 *
 * @param body - The chat request body used to route and generate the response.
 * @returns The raw assistant text and combined HTML body (text + footer).
 */
export async function generateEmailResponse(
  body: ChatRequestBody,
): Promise<{ text: string; html: string }> {
  const { roomId, attachments } = body;
  if (!roomId) {
    throw new Error("roomId is required to generate email response HTML");
  }

  const decision = await getGeneralAgent(body);
  const agent = decision.agent;

  const messages: ModelMessage[] = await getEmailRoomMessages(roomId);

  // Append image attachments as visual content parts to the last user message
  // so the LLM can visually process images (in addition to having download URLs in text)
  if (attachments?.length) {
    const imageAttachments = attachments.filter(a => a.contentType.startsWith("image/"));
    if (imageAttachments.length) {
      const lastUserIdx = messages.findLastIndex(m => m.role === "user");
      if (lastUserIdx >= 0) {
        const msg = messages[lastUserIdx];
        const textContent = typeof msg.content === "string" ? msg.content : "";
        const parts: UserModelMessage["content"] = [
          { type: "text", text: textContent },
          ...imageAttachments.map(att => ({
            type: "image" as const,
            image: new URL(att.downloadUrl),
            mimeType: att.contentType,
          })),
        ];
        messages[lastUserIdx] = { role: "user" as const, content: parts };
      }
    }
  }

  const chatResponse = await agent.generate({ messages });
  const text = chatResponse.text;

  const roomData = await selectRoomWithArtist(roomId);
  const bodyHtml = marked(text);
  const footerHtml = getEmailFooter(roomId, roomData?.artist_name || undefined);
  const html = `${bodyHtml}\n\n${footerHtml}`;

  return { text, html };
}
