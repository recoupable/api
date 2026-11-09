import { z } from "zod";
/** GET is read-only; do not let query arguments select a mutation action. */
export function readIngestionQuery(url: string) {
  const params = new URL(url).searchParams;
  for (const name of params.keys())
    if (params.getAll(name).length !== 1) throw new Error("Invalid ingestion query");
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
