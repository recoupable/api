import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { Client } from "pg";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { producePackAssetStep } from "@/app/workflows/packs/producePackAssetStep";
import { buildReleasePackQuote } from "../../buildReleasePackQuote";
import { getPackExecutionFence } from "../getPackExecutionFence";
import { readPackProviderObservations } from "@/lib/supabase/release_pack_jobs/readPackProviderObservations";
import type { PackActor } from "../../packTypes";
const hooks = vi.hoisted(() => ({
  beforePhase: undefined as undefined | (() => Promise<void>),
  submit: vi.fn(),
  runId: "",
  trace: [] as string[],
}));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (
        ![
          "release_pack_command_v2",
          "release_pack_command",
          "append_pack_provider_observation",
          "read_pack_provider_observations",
        ].includes(name)
      )
        throw new Error("Unexpected local RPC");
      hooks.trace.push(name + (args.p_action ? ":" + args.p_action : ""));
      if (
        name === "release_pack_command_v2" &&
        args.p_action === "phase" &&
        (args.p_input as { value?: { state?: string } }).value?.state === "accepted" &&
        hooks.beforePhase
      ) {
        const act = hooks.beforePhase;
        hooks.beforePhase = undefined;
        await act();
      }
      const client = await localClient();
      try {
        return {
          data: (
            await client.query(
              `SELECT public.${name}(${Object.keys(args)
                .map((_, i) => `$${i + 1}`)
                .join(",")}) AS result`,
              Object.values(args),
            )
          ).rows[0].result,
          error: null,
        };
      } catch (error) {
        return { data: null, error };
      } finally {
        await client.end();
      }
    },
  },
}));
vi.mock("workflow", () => ({ getWorkflowMetadata: () => ({ workflowRunId: hooks.runId }) }));
vi.mock("@/lib/fal/server", () => ({
  default: {
    queue: {
      submit: hooks.submit,
      status: async () => ({ status: "COMPLETED" }),
      result: async () => ({ data: { images: [{ url: "https://example.invalid/original" }] } }),
    },
  },
}));
vi.mock("ai", () => ({ generateText: async () => ({ text: "Synthetic caption" }) }));
vi.mock("@/lib/content/packs/composePackMedia", () => ({
  composePackMedia: async () => ({
    files: [{ storage_key: "synthetic/output", content_type: "image/png", bytes: 1 }],
    probe: {},
  }),
}));
vi.mock("@/lib/content/packs/inspectPackMedia", () => ({
  inspectPackMedia: async () => ({ passed: true, reason: "Synthetic offline inspection" }),
}));
async function localClient(admin = false) {
  const socket = process.env.PACK_FENCE_TEST_SOCKET;
  if (!socket || !socket.includes("/recoup-pack-"))
    throw new Error("Owned local PG socket required");
  const c = new Client({
    host: socket,
    port: Number(process.env.PACK_FENCE_TEST_PORT),
    database: "postgres",
    user: userInfo().username,
  });
  await c.connect();
  if (!admin) await c.query("SET ROLE service_role");
  return c;
}
async function seed(foundation = false) {
  const actor: PackActor = { accountId: randomUUID(), packProtocol: 2 },
    jobId = randomUUID();
  const c = await localClient(true);
  try {
    await c.query("INSERT INTO accounts VALUES($1);", [actor.accountId]);
    await c.query("INSERT INTO credits_usage(account_id,remaining_credits) VALUES($1,10000000)", [
      actor.accountId,
    ]);
  } finally {
    await c.end();
  }
  const brief = {
    artist_name: "Fixture",
    song_title: "Fixture",
    primary_action: "listen",
    allow_creative_defaults: false,
    reference_image_urls: [],
    platforms: ["instagram" as const],
    evidence: [],
    constraints: [],
    audio_url: "https://example.invalid/audio",
  };
  const deliverables = {
    videos: 0,
    artwork: 1,
    quote_cards: foundation ? 1 : 0,
    carousels: 0,
    visualizers: 0,
    video_seconds: 8,
  };
  await runPackCommand(actor, "prepare", jobId, {
    idempotency_key: jobId,
    fingerprint: "a".repeat(64),
    brief,
    deliverables,
    status: "ready_to_quote",
  });
  const quote = {
    ...buildReleasePackQuote(brief, deliverables),
    id: randomUUID(),
    revision: 1,
    expires_at: "2099-01-01T00:00:00Z",
  };
  await runPackCommand(actor, "estimate", jobId, {
    expected_revision: 1,
    quote,
    assets: quote.assets,
  });
  const funded = await runPackCommand(actor, "approve", jobId, {
    request_id: randomUUID(),
    expected_revision: 1,
    source_execution_id: null,
    source_execution_version: 0,
    quote_id: quote.id,
    approved_max_usd: quote.maximum_usd,
  });
  const bound = await runPackCommand(actor, "run", jobId, {
    expected_revision: 1,
    execution_id: funded.job.execution_id,
    execution_version: funded.job.execution_version,
    workflow_run_id: randomUUID(),
  });
  hooks.runId = bound.job.workflow_run_id!;
  return { actor, job: bound.job, asset: bound.assets[0], assets: bound.assets };
}
describe.skipIf(!process.env.PACK_FENCE_TEST_SOCKET)(
  "paired source + actual proposed PostgreSQL",
  () => {
    beforeEach(() => {
      hooks.beforePhase = undefined;
      hooks.trace = [];
      hooks.submit.mockReset().mockResolvedValue({ request_id: "original-request" });
    });
    it("uses real claim/intent/journal/charge/completion and never resubmits a replayed claim", async () => {
      const { actor, job, asset } = await seed();
      await producePackAssetStep(actor, job, asset.id, false, 0);
      const saved = await runPackCommand(actor, "read", job.id);
      expect(saved.assets[0].status).toBe("completed");
      expect(saved.job.consumed_credits).toBe(asset.credits);
      const page = await readPackProviderObservations(actor, job.id);
      expect(page.operations).toHaveLength(1);
      expect((page.operations[0].observations as { kind: string }[]).map(x => x.kind)).toEqual([
        "accepted",
        "completed",
      ]);
      await expect(producePackAssetStep(actor, job, asset.id, false, 0)).rejects.toThrow(
        "reconciliation",
      );
      expect(hooks.submit).toHaveBeenCalledTimes(1);
      await runPackCommand(actor, "settle", job.id, getPackExecutionFence(job));
    });
    it("rejects a different actual workflow before claim or provider effects", async () => {
      const { actor, job, asset } = await seed();
      hooks.runId = "different-run";
      hooks.trace = [];
      await expect(producePackAssetStep(actor, job, asset.id, false, 0)).rejects.toThrow(
        "workflow",
      );
      expect(hooks.trace).toEqual([]);
      expect(hooks.submit).not.toHaveBeenCalled();
    });
    it("accepts dependent image-edit only with the retained ready foundation binding", async () => {
      const { actor, job, assets } = await seed(true);
      const artwork = assets.find(a => a.kind === "artwork")!,
        dependent = assets.find(a => a.kind === "quote_card")!;
      await producePackAssetStep(actor, job, artwork.id, false, 0);
      const binding = { plan_sha256: "b".repeat(64), asset_sha256: "c".repeat(64) };
      const context = {
        shared_foundation: {
          state: "ready",
          plan: {
            digest: binding.plan_sha256,
            job_id: job.id,
            owner_id: job.owner_id,
            revision: job.revision,
            quote_id: job.quote!.id,
            asset_id: artwork.id,
            dependent_asset_ids: [dependent.id],
          },
          asset_sha256: binding.asset_sha256,
          dependency_bindings: [{ asset_id: dependent.id, attempt: 1 }],
          files: [{ storage_key: "synthetic/output", sha256: "d".repeat(64) }],
        },
      };
      await runPackCommand(actor, "context", job.id, {
        ...getPackExecutionFence(job),
        context_version: job.context_version,
        value: context,
      });
      const dependentJob = {
        ...job,
        brief: {
          ...job.brief,
          reference_image_urls: ["https://example.invalid/retained-foundation"],
        },
        shared_foundation_binding: binding,
      };
      await producePackAssetStep(actor, dependentJob, dependent.id, false, 0);
      const saved = await runPackCommand(actor, "read", job.id);
      expect(saved.assets.every(a => a.status === "completed")).toBe(true);
      expect(hooks.submit).toHaveBeenCalledTimes(2);
      const page = await readPackProviderObservations(actor, job.id);
      expect(page.operations.map(o => o.model).sort()).toEqual(
        [
          job.quote!.execution_config.models.image,
          job.quote!.execution_config.models.image_edit,
        ].sort(),
      );
    });
    it("refuses an unretained foundation binding before dependent submission", async () => {
      const { actor, job, assets } = await seed(true);
      const artwork = assets.find(a => a.kind === "artwork")!;
      const dependent = assets.find(a => a.kind === "quote_card")!;
      await producePackAssetStep(actor, job, artwork.id, false, 0);
      const before = await runPackCommand(actor, "read", job.id);
      await expect(
        producePackAssetStep(
          actor,
          {
            ...job,
            brief: { ...job.brief, reference_image_urls: ["https://example.invalid/unretained"] },
            shared_foundation_binding: {
              plan_sha256: "b".repeat(64),
              asset_sha256: "c".repeat(64),
            },
          },
          dependent.id,
          false,
          0,
        ),
      ).rejects.toThrow("reconciliation");
      const after = await runPackCommand(actor, "read", job.id);
      expect(after.job.consumed_credits).toBe(before.job.consumed_credits);
      expect(after.assets.find(a => a.id === dependent.id)?.provider_state).toEqual({});
      expect((await readPackProviderObservations(actor, job.id)).operations).toHaveLength(1);
      expect(hooks.submit).toHaveBeenCalledTimes(1);
    });
    it("retains acceptance before actual stale phase refusal without catch finish or charge", async () => {
      const { actor, job, asset } = await seed();
      hooks.beforePhase = async () => {
        await runPackCommand(actor, "settle", job.id, getPackExecutionFence(job));
      };
      await expect(producePackAssetStep(actor, job, asset.id, false, 0)).rejects.toThrow(
        "reconciliation",
      );
      const saved = await runPackCommand(actor, "read", job.id);
      expect(saved.job.consumed_credits).toBe(0);
      expect(saved.assets[0].status).toBe("uncertain");
      const page = await readPackProviderObservations(actor, job.id);
      expect((page.operations[0].observations as { kind: string }[]).map(x => x.kind)).toEqual([
        "accepted",
      ]);
      expect(hooks.trace.filter(x => x.endsWith(":finish_asset"))).toHaveLength(0);
      expect(hooks.submit).toHaveBeenCalledTimes(1);
    });
  },
);
