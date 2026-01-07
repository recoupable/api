import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendEmailSchema, type SendEmailInput } from "./sendEmailSchema";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { getResendClient } from "@/lib/emails/client";
import { getEmailFooter } from "@/lib/emails/getEmailFooter";
import { RECOUP_FROM_EMAIL } from "@/lib/const";

/**
 * Registers the "send_email" tool on the MCP server.
 * Sends an email with the specified recipients, subject, and body.
 * Automatically appends the standard email footer.
 *
 * @param server - The MCP server instance to register the tool on.
 */
export function registerSendEmailTool(server: McpServer): void {
  server.registerTool(
    "send_email",
    {
      description:
        "Send an email to one or more recipients. Use this to send emails on behalf of the user.",
      inputSchema: sendEmailSchema,
    },
    async (args: SendEmailInput) => {
      const { to, subject, body, room_id } = args;

      const footer = getEmailFooter(room_id);
      const htmlBody = `${body}\n\n${footer}`;

      const resend = getResendClient();
      const { data, error } = await resend.emails.send({
        from: RECOUP_FROM_EMAIL,
        to,
        subject,
        html: htmlBody,
      });

      if (error) {
        return getToolResultError(`Failed to send email: ${error.message}`);
      }

      return getToolResultSuccess({
        success: true,
        email_id: data?.id,
        message: `Email sent successfully to ${to.join(", ")}`,
      });
    },
  );
}
