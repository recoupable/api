import { z } from "zod";
import type { PlanNode } from "./enrichmentPlanTypes";

/** Reject malformed dependency plans before authorization or provider work. */
export function validateContextEnrichmentPlan(plan: PlanNode[], concurrency: number): void {
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
}
