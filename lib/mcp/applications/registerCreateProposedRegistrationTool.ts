import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createProposedApplicationRegistration } from "@/lib/applications/proposedRegistration/createProposedApplicationRegistration";
import {
  proposedCreateInputSchema,
  ProposedStorageFailure,
} from "@/lib/applications/proposedRegistration/proposedRegistrationContract";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import {
  guardProposedRegistrationStorage,
  type ProposedMcpInvocation,
} from "./guardProposedRegistrationStorage";
/** Inactive SDK registration; only the server closure supplies request and dependencies. */
export function registerCreateProposedRegistrationTool(
  server: McpServer,
  context: ProposedMcpInvocation,
) {
  server.registerTool(
    "create_application_registration",
    {
      description: "Create an inactive proposed application registration receipt.",
      inputSchema: proposedCreateInputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args, extra) => {
      try {
        const dependencies = await guardProposedRegistrationStorage(
          context,
          "create",
          extra.signal,
        );
        const result = await context.life.run(() =>
          createProposedApplicationRegistration(context.request, args, dependencies),
        );
        return getToolResultSuccess(result);
      } catch (error) {
        const message =
          error instanceof ProposedStorageFailure
            ? error.kind === "denied"
              ? "Proposed storage denied"
              : error.kind === "conflict"
                ? "Proposed storage conflict"
                : "Storage outcome unknown; retain original operation, key and input"
            : "Registration unavailable; retain original operation, key and input if invoked";
        return { ...getToolResultError(message), isError: true };
      }
    },
  );
}
