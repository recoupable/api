import { marked } from "marked";
import { ChatRequestBody } from "@/lib/chat/validateChatRequest";
import getGeneralAgent from "@/lib/agents/generalAgent/getGeneralAgent";
import { getEmailRoomMessages } from "@/lib/emails/inbound/getEmailRoomMessages";

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

  const bodyHtml = marked(text);

  const footerHtml = `
<hr style="margin-top:24px;margin-bottom:16px;border:none;border-top:1px solid #e5e7eb;" />
<p style="font-size:12px;color:#6b7280;margin:0 0 4px;">
  Note: you can reply directly to this email to continue the conversation.
</p>
<p style="font-size:12px;color:#6b7280;margin:0;">
  Or continue the conversation on Recoup:
  <a href="https://chat.recoupable.com/chat/${roomId}" target="_blank" rel="noopener noreferrer">
    https://chat.recoupable.com/chat/${roomId}
  </a>
</p>
`.trim();

  const html = `${bodyHtml}\n\n${footerHtml}`;

  return { text, html };
}
