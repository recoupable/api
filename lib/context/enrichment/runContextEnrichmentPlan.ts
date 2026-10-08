import { ContextNodeNeedsReconciliation } from "../planning/ContextNodeNeedsReconciliation";
import { runContextEnrichment } from "./runContextEnrichment";
import type { PlanNode, Outcome } from "./enrichmentPlanTypes";
import { validateContextEnrichmentPlan } from "./validateContextEnrichmentPlan";
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
  validateContextEnrichmentPlan(plan, concurrency);
  await deps.authorize(actor, owner);
  const outcomes = new Map<string, Outcome>();
  const running = new Map<string, Promise<void>>();
  let reconciliationError: ContextNodeNeedsReconciliation | undefined;
  while (outcomes.size < plan.length) {
    if (reconciliationError) {
      await Promise.allSettled(running.values());
      throw reconciliationError;
    }
    const ready = plan.filter(
      n => !outcomes.has(n.key) && !running.has(n.key) && n.dependsOn.every(k => outcomes.has(k)),
    );
    for (const node of ready.slice(0, concurrency - running.size)) {
      const task = (async () => {
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
        } catch (error) {
          if (error instanceof ContextNodeNeedsReconciliation) {
            reconciliationError ??= error;
            throw error;
          }
          outcomes.set(node.key, {
            key: node.key,
            status: "failed",
            failureStage,
            startedAt,
            elapsedMs: Date.now() - start,
          });
        }
      })();
      running.set(node.key, task);
      const removeFinished = () => {
        running.delete(node.key);
      };
      void task.then(removeFinished, removeFinished);
    }
    if (running.size) {
      try {
        await Promise.race(running.values());
      } catch (error) {
        await Promise.allSettled(running.values());
        throw error;
      }
    }
  }
  return plan.map(n => outcomes.get(n.key)!);
}
