import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendEmailSchema, type SendEmailInput } from "@/lib/emails/sendEmailSchema";
import { sendEmailWithResend } from "@/lib/emails/sendEmail";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { RECOUP_FROM_EMAIL } from "@/lib/const";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";
import { NextResponse } from "next/server";

/**
 * Registers the "send_email" tool on the MCP server.
 * Send an email using the Resend API.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerSendEmailTool(server: McpServer): void {
  server.registerTool(
    "send_email",
    {
      description: `Send an email using the Resend API. Requires 'to' and 'subject'. Optionally include 'text', 'html', and custom headers.\n\nNotes:\n- Emails are sent from ${RECOUP_FROM_EMAIL}.\n- Use context to make the email creative and engaging.\n- Use this tool to send transactional or notification emails to users or admins.`,
      inputSchema: sendEmailSchema,
    },
    async (args: SendEmailInput) => {
      const { to, cc = [], subject, text, html = "", headers = {}, room_id } = args;

      const footer = getEmailFooter(room_id);
      const bodyHtml = html || (text ? `<p>${text}</p>` : "");
      const htmlWithFooter = `${bodyHtml}\n\n${footer}`;

      const result = await sendEmailWithResend({
        from: RECOUP_FROM_EMAIL,
        to,
        cc: cc.length > 0 ? cc : undefined,
        subject,
        html: htmlWithFooter,
        headers,
      });

      if (result instanceof NextResponse) {
        const data = await result.json();
        return getToolResultError(
          data?.error?.message || `Failed to send email from ${RECOUP_FROM_EMAIL} to ${to}.`,
        );
      }

      return getToolResultSuccess({
        success: true,
        message: `Email sent successfully from ${RECOUP_FROM_EMAIL} to ${to}. CC: ${cc.length > 0 ? JSON.stringify(cc) : "none"}.`,
        data: result,
      });
    },
  );
}
