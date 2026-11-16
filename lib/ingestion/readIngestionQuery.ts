import { z } from "zod";
import { ingestionOperationSchema } from "./schemas";
/** GET is read-only; do not let query arguments select a mutation action. */
export function readIngestionQuery(url: string) {
  const params = new URL(url).searchParams;
  for (const name of params.keys())
    if (params.getAll(name).length !== 1) throw new Error("Invalid ingestion query");
  const action = params.get("action");
  if (action !== null) {
    if (!["datasets", "imports", "records"].includes(action))
      throw new Error("Invalid ingestion query");
    const input: Record<string, unknown> = Object.fromEntries(params);
    for (const key of ["limit", "after_row"]) {
      if (params.has(key)) {
        const text = params.get(key)!;
        if (!/^\d{1,5}$/.test(text)) throw new Error("Invalid ingestion query");
        input[key] = Number(text);
      }
    }
    return ingestionOperationSchema.parse(input);
  }
  const query = z
    .strictObject({
      job_id: z.string().regex(/^[a-f0-9]{64}$/),
      organization_id: z.uuid().optional(),
      stage: z.enum(["bronze", "silver", "gold"]).optional(),
    })
    .parse(Object.fromEntries(params));
  return query.stage
    ? { ...query, action: "artifact" as const }
    : { ...query, action: "read" as const };
}
