import { z } from "zod";
const nodeSchema = z.looseObject({
  key: z.string().min(1),
  dependsOn: z.array(z.string().min(1)),
  reasons: z.array(z.string().min(1).max(500)).max(100).default([]),
  state: z.enum(["ready_for_dispatch", "reuse_candidate", "blocked", "not_implemented"]),
});
type Node = z.infer<typeof nodeSchema>;
interface Outcome {
  key: string;
  status: "saved" | "reused" | "failed" | "blocked";
  blockedBy?: string[];
  blockReason?: "plan_blocked" | "not_implemented" | "dependency_failed";
  reasons?: string[];
  failureStage?: "authorize" | "dispatch";
  receipt?: unknown;
}
interface Dependencies {
  authorize: (node: Node) => Promise<unknown>;
  dispatch: (node: Node, receipts: Record<string, unknown>) => Promise<{ state: string }>;
  persistOutcome: (outcome: Outcome) => Promise<unknown>;
}
/**
 * In-process bridge from server-built plans to collectors which already claim/save evidence.
 * Callers supply scoped dispatch and trace storage; this is not a durable workflow host.
 * A reuse candidate still enters its collector. Dispatch must enforce spend policy if reuse misses.
 * No retries: ambiguous provider or persistence failures must be reconciled by the caller.
 */
export async function runPlannedContextModules(
  input: unknown,
  deps: Dependencies,
  concurrency = 3,
): Promise<Outcome[]> {
  const plan = z.array(nodeSchema).max(100).parse(input);
  z.number().int().min(1).max(10).parse(concurrency);
  const keys = new Set(plan.map(node => node.key));
  if (keys.size !== plan.length) throw new Error("Duplicate module keys");
  if (plan.some(node => node.dependsOn.some(key => !keys.has(key))))
    throw new Error("Unknown module dependency");
  const visited = new Set<string>();
  while (visited.size < plan.length) {
    const ready = plan.filter(
      node => !visited.has(node.key) && node.dependsOn.every(key => visited.has(key)),
    );
    if (!ready.length) throw new Error("Cyclic module dependencies");
    ready.forEach(node => visited.add(node.key));
  }
  const outcomes = new Map<string, Outcome>();
  while (outcomes.size < plan.length) {
    const ready = plan
      .filter(node => !outcomes.has(node.key) && node.dependsOn.every(key => outcomes.has(key)))
      .slice(0, concurrency);
    const settled = await Promise.allSettled(
      ready.map(async node => {
        const blockedBy = node.dependsOn.filter(key =>
          ["failed", "blocked"].includes(outcomes.get(key)!.status),
        );
        let outcome: Outcome;
        if (blockedBy.length || ["blocked", "not_implemented"].includes(node.state)) {
          outcome = {
            key: node.key,
            status: "blocked",
            blockedBy,
            blockReason: blockedBy.length
              ? "dependency_failed"
              : node.state === "not_implemented"
                ? "not_implemented"
                : "plan_blocked",
            // Planner explanations are server-owned; provider exceptions remain excluded.
            reasons: node.reasons,
          };
        } else {
          let failureStage: Outcome["failureStage"] = "authorize";
          try {
            await deps.authorize(node);
            failureStage = "dispatch";
            const receipts = Object.fromEntries(
              node.dependsOn.map(key => [key, outcomes.get(key)!.receipt]),
            );
            const receipt = await deps.dispatch(node, receipts);
            if (!["saved", "reused"].includes(receipt.state))
              throw new Error("Collector did not return a saved or reused receipt");
            outcome = { key: node.key, status: receipt.state as "saved" | "reused", receipt };
          } catch {
            outcome = { key: node.key, status: "failed", failureStage };
          }
        }
        // Persistence failure aborts scheduling; it must never look like a saved dependency.
        await deps.persistOutcome(outcome);
        outcomes.set(node.key, outcome);
      }),
    );
    const failure = settled.find(result => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
  return plan.map(node => outcomes.get(node.key)!);
}
