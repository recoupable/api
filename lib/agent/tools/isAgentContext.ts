import type { AgentContext } from "@/lib/agent/tools/AgentContext";

/**
 * Type-guard that confirms an arbitrary `experimental_context` shape has
 * the AgentContext fields tools rely on at runtime. Validates each required
 * leaf (sandbox object, state object, non-empty workingDirectory) so callers
 * can trust the narrowed type — earlier weaker guards returned true for
 * `{ sandbox: null }` or `{ sandbox: {} }`, letting tools later crash on
 * "cannot read .x of undefined".
 *
 * @param value - The opaque context object passed by AI SDK to tool execute.
 */
export function isAgentContext(value: unknown): value is AgentContext {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as { sandbox?: unknown };
  const sandbox = candidate.sandbox;
  if (typeof sandbox !== "object" || sandbox === null) return false;

  const sandboxFields = sandbox as { state?: unknown; workingDirectory?: unknown };
  if (typeof sandboxFields.state !== "object" || sandboxFields.state === null) return false;
  if (typeof sandboxFields.workingDirectory !== "string") return false;
  if (sandboxFields.workingDirectory.length === 0) return false;

  return true;
}
