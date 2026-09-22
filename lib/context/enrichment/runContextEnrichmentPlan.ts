import { z } from "zod";
import { runContextEnrichment, type ContextEnrichmentModule } from "./runContextEnrichment";
interface PlanNode {
  key: string;
  dependsOn: string[];
  /** Receipts identify saved evidence; load its authorized content here when needed. */
  prepare: (receipts: Record<string, unknown>) => Promise<ContextEnrichmentModule>;
}
interface Outcome {
  key: string;
  status: "saved" | "reused" | "failed" | "blocked";
  startedAt?: string;
  elapsedMs?: number;
  receipt?: unknown;
  blockedBy?: string[];
  failureStage?: "authorize" | "prepare" | "execute_or_persist";
}
type Dependencies = Parameters<typeof runContextEnrichment>[4];
/**
 * Execute a server-built dependency plan using the existing independently persisted runner.
 * This is an in-process coordinator, not a durable workflow host. Providers retain their
 * own rate limits. No retries; private inputs and raw exception messages are not logged.
 */
export async function runContextEnrichmentPlan(
  actor: string,
  owner: string,
  requestId: string,
  plan: PlanNode[],
  deps: Dependencies,
  concurrency = 3,
): Promise<Outcome[]> {
  z.number().int().min(1).max(10).parse(concurrency);
  z.array(z.object({ key: z.string().min(1), dependsOn: z.array(z.string().min(1)) }))
    .max(100)
    .parse(plan);
  const keys = new Set(plan.map(n => n.key));
  if (keys.size !== plan.length) throw new Error("Duplicate module keys");
  if (plan.some(n => n.dependsOn.some(key => !keys.has(key))))
    throw new Error("Unknown module dependency");
  const visited = new Set<string>();
  while (visited.size < plan.length) {
    const ready = plan.filter(n => !visited.has(n.key) && n.dependsOn.every(k => visited.has(k)));
    if (!ready.length) throw new Error("Cyclic module dependencies");
    ready.forEach(n => visited.add(n.key));
  }
  await deps.authorize(actor, owner);
  const outcomes = new Map<string, Outcome>();
  while (outcomes.size < plan.length) {
    const ready = plan.filter(n => !outcomes.has(n.key) && n.dependsOn.every(k => outcomes.has(k)));
    await Promise.all(
      ready.slice(0, concurrency).map(async node => {
        const blockedBy = node.dependsOn.filter(k =>
          ["failed", "blocked"].includes(outcomes.get(k)!.status),
        );
        if (blockedBy.length) {
          outcomes.set(node.key, { key: node.key, status: "blocked", blockedBy });
          return;
        }
        const startedAt = new Date().toISOString(),
          start = Date.now();
        let failureStage: Outcome["failureStage"] = "authorize";
        try {
          // Authorization can change while another independent module runs.
          await deps.authorize(actor, owner);
          failureStage = "prepare";
          const receipts = Object.fromEntries(
            node.dependsOn.map(k => [k, outcomes.get(k)!.receipt]),
          );
          const module = await node.prepare(receipts);
          if (module.key !== node.key) throw new Error("Prepared module key does not match plan");
          failureStage = "execute_or_persist";
          const receipt = await runContextEnrichment(actor, owner, requestId, module, deps);
          const reused =
            typeof receipt === "object" &&
            receipt !== null &&
            "state" in receipt &&
            receipt.state === "reused";
          outcomes.set(node.key, {
            key: node.key,
            status: reused ? "reused" : "saved",
            startedAt,
            elapsedMs: Date.now() - start,
            receipt,
          });
        } catch {
          outcomes.set(node.key, {
            key: node.key,
            status: "failed",
            failureStage,
            startedAt,
            elapsedMs: Date.now() - start,
          });
        }
      }),
    );
  }
  return plan.map(n => outcomes.get(n.key)!);
}
