import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolveAccountId } from "@/lib/mcp/resolveAccountId";
import type { McpAuthInfo } from "@/lib/mcp/verifyApiKey";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import { applicationRegistrationSchema } from "@/lib/applications/applicationRegistrationSchema";
import { validateApplicationRegistration } from "@/lib/applications/validateApplicationRegistration";
import { registrationErrorResponse } from "@/lib/applications/registrationErrorResponse";
/** Read-only registration preflight over the same domain operation as HTTP. */
export function registerValidateApplicationRegistrationTool(server: McpServer) {
  server.registerTool(
    "validate_application_registration",
    {
      description:
        "Validate proposed application origins, return URLs and workspace billing ownership. Does not register an application, verify domains, issue credentials, authorize spending or create fan identities.",
      inputSchema: applicationRegistrationSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, extra) => {
      const auth = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (!auth.accountId || auth.error)
        return { ...getToolResultError("Authentication required"), isError: true };
      try {
        return getToolResultSuccess(await validateApplicationRegistration(auth.accountId, args));
      } catch (error) {
        return { ...getToolResultError(registrationErrorResponse(error).error), isError: true };
      }
    },
  );
}
