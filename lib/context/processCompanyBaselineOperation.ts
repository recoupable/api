import type { z } from "zod";
import { companyBaselineOperationSchema, companyBaselineSchema } from "./companyBaselineSchema";

/** Read registered metadata only, after shared owner authorization. */
export async function processCompanyBaselineOperation(
  actor: string,
  owner: string,
  args: z.infer<typeof companyBaselineOperationSchema>,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  if (owner !== args.organization_id) throw new Error("Company baseline scope mismatch");
  const result = companyBaselineSchema.parse(
    await rpc("read_context_company_baseline", {
      p_actor: actor,
      p_org: owner,
      p_after_artist: args.after_artist_id ?? null,
      p_after_professional: args.after_professional_id ?? null,
      p_after_source: args.after_source_id ?? null,
    }),
  );
  if (result.organization_id !== owner) throw new Error("Company baseline scope mismatch");
  return result;
}
