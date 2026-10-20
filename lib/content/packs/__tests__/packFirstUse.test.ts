import { beforeEach, describe, expect, it, vi } from "vitest";
import { processPackOperation } from "../processPackOperation";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
const fixture = vi.hoisted(() => ({ saved: null as any, composedAudio: "" }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(async () => true),
}));
vi.mock("@/lib/artists/getArtists", () => ({ getArtists: vi.fn(async () => []) }));
vi.mock("@/lib/credits/checkCreditsAvailable", () => ({
  checkCreditsAvailable: vi.fn(async () => ({ kind: "available" })),
}));
vi.mock("../importPackSources", () => ({
  importPackSources: vi.fn(async () => ({
    audio: {
      storage_key: "owner/release-packs/source.wav",
      sha256: "fixture",
      content_type: "audio/wav",
      bytes: 100,
    },
    references: [],
  })),
}));
vi.mock("../assertPackExecutionReady", () => ({ assertPackExecutionReady: vi.fn() }));
vi.mock("../loadPackContextBrief", () => ({
  loadPackContextBrief: vi.fn(async (_actor, brief) => brief),
}));
vi.mock("../preparePackProduction", () => ({
  preparePackProduction: vi.fn(async (_actor, job) => job),
}));
vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: vi.fn(
    async ({ key }) => `https://storage.example/${key}?signed=fixture`,
  ),
}));
vi.mock("workflow", () => ({ getWorkflowMetadata: () => ({ workflowRunId: "fixture-workflow" }) }));
vi.mock("workflow/api", () => ({
  start: vi.fn(async (fn, args) => {
    await fn(...args);
    return { runId: "fixture-workflow" };
  }),
}));
vi.mock("@/lib/supabase/release_pack_jobs/runPackCommand", () => ({ runPackCommand: vi.fn() }));
vi.mock("../createPackProductionServices", () => ({
  createPackProductionServices: (actor: any, job: any, asset: any) => ({
    phase: (phase: string, value: unknown) =>
      runPackCommand(actor, "phase", job.id, { asset_id: asset.id, phase, value }),
    generateImages: async () => ["https://provider.example/still.png"],
    generateMotion: async () => "https://provider.example/motion.mp4",
    caption: async () => "Rediscover First Song by New Artist.",
    compose: async (input: any) => {
      fixture.composedAudio = input.audioUrl;
      return {
        files: [
          {
            storage_key: `owner/release-packs/${asset.id}.mp4`,
            content_type: "video/mp4",
            bytes: 1000,
          },
        ],
        probe: { audio: true, duration: 8, width: 1080, height: 1920 },
      };
    },
    inspect: async () => ({ passed: true, reason: "Rendered fixture reviewed" }),
    finish: (result: any) =>
      runPackCommand(actor, "finish_asset", job.id, { asset_id: asset.id, ...result }),
  }),
}));
describe("new-buyer pack acceptance fixture", () => {
  beforeEach(() => {
    fixture.saved = null;
    fixture.composedAudio = "";
    vi.clearAllMocks();
    vi.mocked(runPackCommand).mockImplementation(async (actor, action, jobId, input = {}) => {
      if (action === "prepare")
        fixture.saved = {
          job: {
            id: jobId,
            owner_id: actor.accountId,
            created_by: actor.accountId,
            revision: 1,
            status: input.status,
            brief: input.brief,
            deliverables: input.deliverables,
            held_credits: 0,
            consumed_credits: 0,
            quote: null,
            workflow_run_id: null,
            error: null,
          },
          assets: [],
        };
      const s = fixture.saved;
      if (action === "estimate") {
        s.job.quote = input.quote;
        s.job.status = "awaiting_approval";
        s.assets = (input.assets as any[]).map((plan, index) => ({
          ...plan,
          id: `asset-${index}`,
          job_id: jobId,
          status: "pending",
          attempt: 0,
          provider_state: {},
          files: [],
          caption: null,
          qa: null,
          error: null,
        }));
      }
      if (action === "approve") {
        s.job.status = "running";
        s.dispatch = true;
        s.job.held_credits = s.job.quote.credits;
      }
      if (action === "claim") {
        const a = s.assets.find((x: any) => x.id === input.asset_id);
        a.status = "running";
        a.attempt++;
        return { ...s, claimed: true, asset: a };
      }
      if (action === "phase")
        s.assets.find((a: any) => a.id === input.asset_id).provider_state[input.phase as string] =
          input.value;
      if (action === "finish_asset") {
        Object.assign(
          s.assets.find((a: any) => a.id === input.asset_id),
          input,
        );
        if (input.status === "completed") s.job.first_usable_asset_at = "2026-10-20T12:00:00Z";
      }
      if (action === "settle") {
        s.job.status = s.assets.every((a: any) => a.status === "completed")
          ? "completed"
          : "failed";
        s.job.held_credits = 0;
        s.dispatch = false;
      }
      if (action === "run") s.job.workflow_run_id = input.workflow_run_id;
      return structuredClone(s);
    });
  });
  it("prepares, quotes, runs and reads a reviewed song-backed video without an artist or repository", async () => {
    const prepared = (await processPackOperation("owner", "prepare", {
      idempotency_key: "first-use",
      brief: {
        artist_name: "New Artist",
        song_title: "First Song",
        audio_url: "https://music.example/source.wav",
        occasion: "rediscovery",
        allow_creative_defaults: true,
      },
      deliverables: {
        videos: 1,
        quote_cards: 0,
        artwork: 0,
        carousels: 0,
        visualizers: 0,
        video_seconds: 8,
      },
    })) as any;
    expect(prepared.readiness.ready).toBe(true);
    expect(prepared.job.brief.artist_account_id).toBeUndefined();
    const estimated = (await processPackOperation("owner", "estimate", {
      job_id: prepared.job.id,
    })) as any;
    await processPackOperation("owner", "generate", {
      job_id: prepared.job.id,
      quote_id: estimated.job.quote.id,
      expected_revision: 1,
      approved_max_usd: estimated.job.quote.maximum_usd,
    });
    const read = (await processPackOperation("owner", "get", { job_id: prepared.job.id })) as any;
    expect(read.job.status).toBe("completed");
    expect(read.assets[0].usable).toBe(true);
    expect(read.assets[0].caption).toContain("First Song");
    expect(read.assets[0].files[0].url).toContain("signed=fixture");
    expect(read.job.first_usable_asset_at).toBeTruthy();
    expect(fixture.composedAudio).toBe("https://music.example/source.wav");
  });
});
