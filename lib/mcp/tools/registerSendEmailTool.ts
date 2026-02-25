import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sendEmailSchema, type SendEmailInput } from "@/lib/emails/sendEmailSchema";
import { processAndSendEmail } from "@/lib/emails/processAndSendEmail";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { RECOUP_FROM_EMAIL } from "@/lib/const";

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
      const result = await processAndSendEmail(args);

      if (!result.success) {
        return getToolResultError(result.error);
      }

      return getToolResultSuccess({
        success: true,
        message: result.message,
        data: { id: result.id },
      });
    },
  );
}
