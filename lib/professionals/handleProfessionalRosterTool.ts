import { z } from "zod";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { processProfessionalRoster } from "./processProfessionalRoster";
import { ProfessionalRosterError } from "./ProfessionalRosterError";

/** Resolve the authenticated actor before the shared, database-authorized operation. */
export async function handleProfessionalRosterTool(
  action: "list" | "confirm",
  args: unknown,
  authInfo: McpAuthInfo | undefined,
) {
  try {
    const { accountId, error } = await resolveAccountId({ authInfo, accountIdOverride: undefined });
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
}
