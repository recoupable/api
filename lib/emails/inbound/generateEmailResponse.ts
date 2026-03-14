import { marked } from "marked";
import { ChatRequestBody } from "@/lib/chat/validateChatRequest";
import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";
import { getEmailRoomMessages } from "@/lib/emails/inbound/getEmailRoomMessages";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";
import { selectRoomWithArtist } from "@/lib/supabase/rooms/selectRoomWithArtist";

/**
 * Generates the assistant response HTML for an email, including:
 * - Running the general agent to generate a reply for the given room
 * - Fetching the room messages
 * - Appending a standardized footer with reply and link instructions
 *
 * @param body - The chat request body used to route and generate the response.
 * @returns The raw assistant text and combined HTML body (text + footer).
 */
export async function generateEmailResponse(
  body: ChatRequestBody,
): Promise<{ text: string; html: string }> {
  const { roomId } = body;
  if (!roomId) {
    throw new Error("roomId is required to generate email response HTML");
  }

  const decision = await getGeneralAgent(body);
  const agent = decision.agent;

  const messages = await getEmailRoomMessages(roomId);

  const chatResponse = await agent.generate({ messages });
  const text = chatResponse.text;

  const roomData = await selectRoomWithArtist(roomId);
  const bodyHtml = marked(text);
  const footerHtml = getEmailFooter(roomId, roomData?.artist_name || undefined);
  const html = `${bodyHtml}\n\n${footerHtml}`;

  return { text, html };
}
