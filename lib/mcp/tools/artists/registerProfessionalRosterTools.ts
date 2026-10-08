import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { confirmProfessionalSchema, listProfessionalsSchema } from "@/lib/professionals/schema";
import { handleProfessionalRosterTool } from "@/lib/professionals/handleProfessionalRosterTool";

/** API-key MCP only; delegated OAuth organization scopes require a separate audit. */
export function registerProfessionalRosterTools(server: McpServer) {
  server.registerTool(
    "list_professional_roster",
    {
      description:
        "List professional records private to an authorized organization. Follow next_cursor with after to inspect all candidates. Names do not prove identity.",
      inputSchema: listProfessionalsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    },
    (args, extra) =>
      handleProfessionalRosterTool("list", args, extra.authInfo as McpAuthInfo | undefined),
  );
  server.registerTool(
    "confirm_professional_roster",
    {
      description:
        "Add a new organization-private professional or roles to an existing professional ID. Requires explicit user roster intent and identity confirmation; never infer confirmation from research or name similarity. No login account, catalog rights, enrichment, or cross-workspace profile copying. Reuse idempotency_key on retry.",
      inputSchema: confirmProfessionalSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    (args, extra) =>
      handleProfessionalRosterTool("confirm", args, extra.authInfo as McpAuthInfo | undefined),
  );
}
