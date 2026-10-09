import {
  evidenceManifestPageSchema,
  evidenceManifestOperationSchema,
} from "./evidenceManifestSchemas";
import type { z } from "zod";

/** Metadata discovery only; the database independently checks current actor and request access. */
export async function processEvidenceManifestOperation(
  actor: string,
  owner: string,
  args: z.infer<typeof evidenceManifestOperationSchema>,
  rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>,
) {
  const page = evidenceManifestPageSchema.parse(
    await rpc("list_context_request_evidence_versions", {
      p_actor: actor,
      p_owner: owner,
      p_request: args.request_id,
      p_after: args.after_id ?? null,
    }),
  );
  const ids = page.versions.map(version => version.source_version_id);
  if (
    page.owner_id !== owner ||
    page.request_id !== args.request_id ||
    new Set(ids).size !== ids.length ||
    ids.includes(args.after_id ?? "") ||
    page.versions.some(
      version => new Set(version.evidence_kinds).size !== version.evidence_kinds.length,
    ) ||
    (page.has_more
      ? page.versions.length !== 50 || page.next_id !== ids.at(-1)
      : page.next_id !== null)
  )
    throw new Error("Evidence manifest unavailable");
  return page;
}
