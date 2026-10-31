import type { z } from "zod";

/** Visit each vertex and edge once; iterative traversal also bounds call-stack use. */
export function validateCatalogCaseDependencies(
  records: Map<string, { depends_on?: string[] }>,
  ctx: z.RefinementCtx,
) {
  const remaining = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const [id, record] of records) {
    const dependencies = record.depends_on ?? [];
    remaining.set(id, dependencies.length);
    for (const dependency of dependencies) {
      if (!records.has(dependency)) {
        ctx.addIssue({ code: "custom", message: "Missing or cyclic record dependency" });
        return;
      }
      const children = dependents.get(dependency) ?? [];
      children.push(id);
      dependents.set(dependency, children);
    }
  }
  const ready = [...remaining].filter(([, count]) => count === 0).map(([id]) => id);
  for (let index = 0; index < ready.length; index++) {
    for (const child of dependents.get(ready[index]) ?? []) {
      const count = remaining.get(child)! - 1;
      remaining.set(child, count);
      if (count === 0) ready.push(child);
    }
  }
  if (ready.length !== records.size)
    ctx.addIssue({ code: "custom", message: "Missing or cyclic record dependency" });
}
