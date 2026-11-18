import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readProposedApplicationRegistration } from "@/lib/applications/proposedRegistration/readProposedApplicationRegistration";
import {
  proposedReadInputSchema,
  ProposedStorageFailure,
} from "@/lib/applications/proposedRegistration/proposedRegistrationContract";
import { getToolResultSuccess } from "@/lib/mcp/getToolResultSuccess";
import { getToolResultError } from "@/lib/mcp/getToolResultError";
import {
  guardProposedRegistrationStorage,
  type ProposedMcpInvocation,
} from "./guardProposedRegistrationStorage";
/** Inactive SDK registration; only the server closure supplies request and dependencies. */
export function registerReadProposedRegistrationTool(
  server: McpServer,
  context: ProposedMcpInvocation,
) {
  server.registerTool(
    "read_application_registration",
    {
      description: "Read an inactive proposed application registration receipt.",
      inputSchema: proposedReadInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, extra) => {
      try {
        const dependencies = await guardProposedRegistrationStorage(context, "read", extra.signal);
        const result = await context.life.run(() =>
          readProposedApplicationRegistration(context.request, args, dependencies),
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
