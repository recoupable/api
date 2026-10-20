import { importPackSources } from "./importPackSources";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { validateOrganizationAccess } from "@/lib/organizations/validateOrganizationAccess";
import { getArtists } from "@/lib/artists/getArtists";
import { checkCreditsAvailable } from "@/lib/credits/checkCreditsAvailable";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import {
  prepareReleasePackSchema,
  releasePackLocatorSchema,
  approveReleasePackSchema,
  retryReleasePackSchema,
  estimateReleasePackSchema,
  uploadPackAssetSchema,
} from "./releasePackSchema";
import { buildReleasePackQuote } from "./buildReleasePackQuote";
import { getPackBriefReadiness } from "./getPackBriefReadiness";
import { loadPackContextBrief } from "./loadPackContextBrief";
import { resolvePackCreativeContext } from "./resolvePackCreativeContext";
import { readPackSnapshot } from "./readPackSnapshot";
import { assertPackExecutionReady } from "./assertPackExecutionReady";
import { uploadPackAsset } from "./uploadPackAsset";
import type { PackActor, PackSnapshot, PackQuote } from "./packTypes";
export const packOperationSchemas = {
  prepare: prepareReleasePackSchema,
  get: releasePackLocatorSchema,
  estimate: estimateReleasePackSchema,
  generate: approveReleasePackSchema,
  retry: retryReleasePackSchema,
  upload: uploadPackAssetSchema,
  export: releasePackLocatorSchema,
};
export type PackOperation = keyof typeof packOperationSchemas;
/** One authenticated domain path for REST and native MCP; host OAuth tokens never leave the host adapter. */
export async function processPackOperation(
  accountId: string,
  operation: PackOperation,
  raw: unknown,
  credentialOrganizationId?: string | null,
) {
  const input = packOperationSchemas[operation].parse(raw) as z.infer<
    typeof prepareReleasePackSchema
  > &
    z.infer<typeof approveReleasePackSchema> & { asset_id?: string };
  const organizationId = input.organization_id ?? credentialOrganizationId ?? undefined;
  if (organizationId && !(await validateOrganizationAccess({ accountId, organizationId })))
    throw new Error("Pack workspace access denied");
  const actor: PackActor = { accountId, organizationId };
  if (operation === "upload") return uploadPackAsset(actor, raw);
  if (operation === "prepare") {
    if (input.job_id && !input.expected_revision)
      throw new Error("Updating a pack requires expected_revision");
    if (!input.job_id && input.expected_revision)
      throw new Error("A revision requires a saved job id");
    if (
      input.brief.artist_account_id &&
      !(await getArtists({ accountId })).some(a => a.account_id === input.brief.artist_account_id)
    )
      throw new Error("Artist access denied");
    const brief = await loadPackContextBrief(actor, input.brief);
    const readiness = getPackBriefReadiness(brief);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ brief, deliverables: input.deliverables }))
      .digest("hex");
    const result = await runPackCommand(actor, "prepare", input.job_id ?? randomUUID(), {
      ...input,
      brief,
      fingerprint,
      status: readiness.ready ? "ready_to_quote" : "needs_input",
    });
    return readPackSnapshot(result);
  }
  const saved = await runPackCommand(actor, "read", input.job_id!);
  if (operation === "get") return readPackSnapshot(saved);
  if (operation === "export") {
    const marked = await runPackCommand(actor, "export", saved.job.id);
    return {
      ...(await readPackSnapshot(marked)),
      manifest: {
        version: 1,
        job_id: saved.job.id,
        revision: saved.job.revision,
        occasion: saved.job.brief.occasion,
        caption_files: "Captions are provided inline per creative piece.",
        publishing: "Nothing has been posted or scheduled",
        url_expires_in_seconds: 3600,
      },
    };
  }
  if (operation === "estimate") {
    if (!getPackBriefReadiness(saved.job.brief).ready)
      throw new Error("Complete the saved brief before quoting");
    const full = buildReleasePackQuote(saved.job.brief, saved.job.deliverables);
    const selected = input.asset_id ? saved.assets.find(a => a.id === input.asset_id) : undefined;
    if (input.asset_id && (!selected || selected.status !== "failed"))
      throw new Error("Only a confirmed failed asset can receive a paid retry quote");
    const plan = selected
      ? full.assets.filter(a => a.kind === selected.kind && a.ordinal === selected.ordinal)
      : full.assets;
    const sources =
      saved.job.quote?.sources ??
      (await importPackSources(saved.job.owner_id, resolvePackCreativeContext(saved.job.brief)));
    const quote: PackQuote = {
      sources,
      ...full,
      fingerprint: createHash("sha256")
        .update(
          JSON.stringify({ brief: saved.job.brief, deliverables: saved.job.deliverables, sources }),
        )
        .digest("hex"),
      assets: plan,
      maximum_usd: Number(plan.reduce((sum, a) => sum + a.maximum_usd, 0).toFixed(6)),
      credits: plan.reduce((sum, a) => sum + a.credits, 0),
      creative_piece_count: plan.length,
      generated_file_count: plan.reduce((sum, a) => sum + a.files, 0),
      caption_count: plan.length,
      id: randomUUID(),
      revision: saved.job.revision,
      expires_at: new Date(Date.now() + 900_000).toISOString(),
      ...(selected ? { retry_asset_id: selected.id } : {}),
    };
    if (selected)
      quote.line_items = [
        {
          category: "stills",
          units: selected.kind === "carousel" ? 4 : 1,
          usd: (selected.kind === "carousel" ? 4 : 1) * 0.01,
        },
        {
          category: "motion",
          units: selected.kind === "video" ? saved.job.deliverables.video_seconds : 0,
          usd: selected.kind === "video" ? Math.max(0, quote.maximum_usd - 0.01) : 0,
        },
        ...full.line_items.filter(item => item.included).map(item => ({ ...item, units: 1 })),
      ];
    return readPackSnapshot(
      await runPackCommand(actor, "estimate", saved.job.id, {
        quote,
        assets: plan,
        ...(selected ? { retry_asset_id: selected.id } : {}),
      }),
    );
  }
  const readiness = getPackBriefReadiness(saved.job.brief);
  if (!readiness.ready) throw new Error(`Pack brief is not ready: ${readiness.next_action}`);
  assertPackExecutionReady();
  if (!saved.job.quote) throw new Error("Get a complete quote before approving generation");
  if (saved.job.quote.id !== input.quote_id || saved.job.revision !== input.expected_revision)
    throw new Error("Approval does not match the current quote and revision");
  let funded: PackSnapshot;
  let resumedAssetId: string | undefined;
  if (operation === "retry" && input.asset_id) {
    const selected = saved.assets.find(asset => asset.id === input.asset_id);
    if (!selected) throw new Error("Pack asset not found");
    if (selected.status === "uncertain") {
      const receipts = Object.entries(selected.provider_state).filter(([key]) =>
        key.includes("submission"),
      );
      if (
        !receipts.length ||
        receipts.some(([, value]) => !(value as { request_id?: string }).request_id)
      )
        throw new Error(
          "Submission outcome is uncertain; no safe automatic retry is available. Your existing outputs and brief are retained.",
        );
      funded = await runPackCommand(actor, "resume", saved.job.id, {
        asset_id: selected.id,
        quote_id: input.quote_id,
        expected_revision: input.expected_revision,
        approved_max_usd: input.approved_max_usd,
      });
      resumedAssetId = selected.id;
    } else {
      if (saved.job.quote.retry_asset_id !== input.asset_id)
        throw new Error("Request and approve a fresh estimate for this failed asset first");
      funded = await runPackCommand(actor, "approve", saved.job.id, input);
    }
  } else {
    const credits =
      saved.job.status === "running"
        ? { kind: "available" as const }
        : await checkCreditsAvailable({
            accountId: organizationId ?? accountId,
            creditsToDeduct: saved.job.quote.credits,
          });
    if (credits.kind !== "available")
      throw new Error("Insufficient credits; your brief and quote are saved");
    funded = await runPackCommand(actor, "approve", saved.job.id, input);
  }
  if (funded.dispatch) {
    try {
      const { start } = await import("workflow/api");
      const { releasePackWorkflow } = await import("@/app/workflows/packs/releasePackWorkflow");
      const run = await start(releasePackWorkflow, [actor, saved.job.id, resumedAssetId]);
      funded = await runPackCommand(actor, "run", saved.job.id, { workflow_run_id: run.runId });
    } catch {
      funded = await runPackCommand(actor, "dispatch_uncertain", saved.job.id, {
        error:
          "Workflow dispatch outcome is uncertain. Its budget remains held while accepted work is reconciled. Read this job; do not resubmit.",
      });
    }
  }
  return readPackSnapshot(funded);
}
