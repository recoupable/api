import { createHash } from "node:crypto";
import { z } from "zod";
export interface ContextEnrichmentModule {
  key: string;
  topic: string;
  subjectId: string;
  provider: string;
  model: string;
  input: unknown;
  sources: Array<{ url: string; kind: string; content: unknown }>;
}
const resultSchema = z.object({
  content: z.unknown().refine(v => v !== undefined && v !== null),
  coverage: z.enum(["full", "partial", "unknown"]),
  trace: z.unknown(),
  costUsd: z.number().nonnegative().finite().nullable(),
  costStatus: z.enum(["unknown", "estimated", "confirmed"]),
});
export type ContextEnrichmentResult = z.infer<typeof resultSchema>;
interface Dependencies {
  authorize: (actor: string, owner: string) => Promise<unknown>;
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>;
  call: (module: ContextEnrichmentModule) => Promise<ContextEnrichmentResult>;
}
/** One paid module, persisted independently. Ambiguous attempts require reconciliation, never an automatic retry. */
export async function runContextEnrichment(
  actor: string,
  owner: string,
  requestId: string,
  module: ContextEnrichmentModule,
  deps: Dependencies,
) {
  await deps.authorize(actor, owner);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify([owner, module]))
    .digest("hex");
  const claim = (await deps.rpc("claim_context_enrichment", {
    p_owner: owner,
    p_request: requestId,
    p_module: { ...module, fingerprint },
  })) as { state: string; attemptId?: string };
  if (claim.state === "reused") return claim;
  if (claim.state !== "claimed" || !claim.attemptId)
    throw new Error("Paid attempt requires reconciliation before retry");
  try {
    const result = resultSchema.parse(await deps.call(module));
    await deps.authorize(actor, owner);
    return await deps.rpc("complete_context_enrichment", {
      p_owner: owner,
      p_request: requestId,
      p_attempt: claim.attemptId,
      p_result: result,
    });
  } catch (error) {
    await deps.rpc("fail_context_enrichment", { p_owner: owner, p_attempt: claim.attemptId });
    throw error;
  }
}
