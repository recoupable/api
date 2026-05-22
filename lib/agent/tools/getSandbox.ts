import type { Sandbox } from "@/lib/sandbox/interface";
import { connectVercel } from "@/lib/sandbox/vercel/connect/connectVercel";
import { isAgentContext } from "@/lib/agent/tools/isAgentContext";

/**
 * Resolve a connected `Sandbox` instance from `experimental_context`.
 * Reconnects each call via `connectVercel(state)` rather than caching the
 * handle on context — workflow durability requires that side-effecting
 * resources (sandbox sessions) be re-acquired inside the step that uses
 * them, not passed across event boundaries.
 *
 * @param experimental_context - The opaque context object passed by AI SDK to tool execute.
 * @param toolName - Optional tool name to surface in error messages.
 */
export async function getSandbox(
  experimental_context: unknown,
  toolName?: string,
): Promise<Sandbox> {
  if (!isAgentContext(experimental_context)) {
    const where = toolName ? ` (tool: ${toolName})` : "";
    throw new Error(
      `Sandbox state missing from agent context${where}. ` +
        "Ensure the workflow start payload includes `sandbox.state` and that " +
        "runAgentStep threads it via experimental_context.",
    );
  }
  return connectVercel(experimental_context.sandbox.state);
}
