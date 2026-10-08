import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { confirmProfessionalSchema, listProfessionalsSchema } from "@/lib/professionals/schema";
import { processProfessionalRoster } from "@/lib/professionals/processProfessionalRoster";
import { ProfessionalRosterError } from "@/lib/professionals/ProfessionalRosterError";

/** Register discovery and explicit confirmation separately to preserve roster intent. */
export function registerProfessionalRosterTools(server: McpServer) {
  for (const action of ["list", "confirm"] as const) {
    server.registerTool(
      `${action}_professional_roster`,
      {
        description:
          action === "list"
            ? "List songwriter/producer records private to an authorized organization. Follow next_cursor with after to inspect all candidates. Names do not prove identity."
            : "Add a new organization-private professional or roles to an existing professional ID. Requires explicit user roster intent and identity confirmation; never infer confirmation from a research request or name similarity. No login account, catalog rights, enrichment, or cross-workspace profile copying. Reuse idempotency_key on retry.",
        inputSchema: action === "list" ? listProfessionalsSchema : confirmProfessionalSchema,
        annotations: {
          readOnlyHint: action === "list",
          destructiveHint: false,
          idempotentHint: true,
        },
      },
      async (args, extra) => {
        try {
          const { accountId, error } = await resolveAccountId({
            authInfo: extra.authInfo as McpAuthInfo | undefined,
            accountIdOverride: undefined,
          });
          if (error || !accountId)
            return { ...getToolResultError(error ?? "Authentication required"), isError: true };
          return getToolResultSuccess(await processProfessionalRoster(accountId, action, args));
        } catch (error) {
          return {
            isError: true,
            ...getToolResultError(
              error instanceof z.ZodError
                ? "Invalid professional roster request"
                : error instanceof ProfessionalRosterError
                  ? error.message
                  : "Could not access the professional roster",
            ),
          };
        }
      },
    );
  }
}
