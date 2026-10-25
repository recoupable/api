import { beforeEach, describe, expect, it, vi } from "vitest";
import { processPackOperation } from "../processPackOperation";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { importPackSources } from "../importPackSources";
import { start } from "workflow/api";
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
  const proposedWorld = {
    starting_point: "established",
    working_mode: "guided",
    references: [
      {
        id: "artist",
        title: "Supplied portrait",
        url: "https://media.example/artist.png",
        media_type: "image",
        source_kind: "customer",
        usage: "production",
      },
    ],
    directions: [
      {
        id: "paper",
        name: "Paper world",
        concept: "Cream paper, ink, quiet movement",
        reference_ids: ["artist"],
        board_url: "https://media.example/board.png",
      },
    ],
  };
  const prepareWorld = (context: unknown) =>
    processPackOperation("owner", "prepare", {
      idempotency_key: "creative-first-use",
      brief: {
        artist_name: "New Artist",
        song_title: "First Song",
        audio_url: "https://music.example/source.wav",
        occasion: "rediscovery",
        creative_context: context,
      },
      deliverables: {
        videos: 1,
        quote_cards: 0,
        artwork: 0,
        carousels: 0,
        visualizers: 0,
        video_seconds: 8,
      },
    }) as Promise<any>;
  it.each(["legacy", "changed"])(
    "rejects %s quote before reserving credits or dispatching",
    async kind => {
      const prepared = await prepareWorld({
        ...proposedWorld,
        selection: {
          direction_id: "paper",
          selected_by: "customer",
          decision_note: "Customer selected",
        },
      });
      const estimated = (await processPackOperation("owner", "estimate", {
        job_id: prepared.job.id,
      })) as any;
      if (kind === "legacy") delete fixture.saved.job.quote.execution_config;
      else fixture.saved.job.quote.execution_config_digest = "outdated";
      vi.mocked(runPackCommand).mockClear();
      await expect(
        processPackOperation("owner", "generate", {
          job_id: prepared.job.id,
          quote_id: estimated.job.quote.id,
          expected_revision: 1,
          approved_max_usd: estimated.job.quote.maximum_usd,
        }),
      ).rejects.toThrow(/new estimate/);
      expect(runPackCommand).not.toHaveBeenCalledWith(
        expect.anything(),
        "approve",
        expect.anything(),
        expect.anything(),
      );
      expect(start).not.toHaveBeenCalled();
    },
  );
  it.each(["failed", "uncertain"])(
    "guards configuration without reauthorizing %s attempts",
    async status => {
      const prepared = await prepareWorld({
        ...proposedWorld,
        selection: {
          direction_id: "paper",
          selected_by: "customer",
          decision_note: "Customer selected",
        },
      });
      const estimated = (await processPackOperation("owner", "estimate", {
        job_id: prepared.job.id,
      })) as any;
      const asset = fixture.saved.assets[0];
      asset.id = crypto.randomUUID();
      asset.status = status;
      asset.provider_state = {
        image_submission_0: { state: "accepted", request_id: "receipt", model: "original-route" },
      };
      fixture.saved.job.quote.retry_asset_id = asset.id;
      delete fixture.saved.job.quote.execution_config;
      vi.mocked(runPackCommand).mockClear();
      const request = processPackOperation("owner", "retry", {
        job_id: prepared.job.id,
        asset_id: asset.id,
        quote_id: estimated.job.quote.id,
        expected_revision: 1,
        approved_max_usd: estimated.job.quote.maximum_usd,
      });
      if (status === "failed") await expect(request).rejects.toThrow(/new estimate/);
      else {
        await request;
        expect(runPackCommand).toHaveBeenCalledWith(
          expect.anything(),
          "resume",
          prepared.job.id,
          expect.objectContaining({ asset_id: asset.id }),
        );
      }
      expect(runPackCommand).not.toHaveBeenCalledWith(
        expect.anything(),
        "approve",
        expect.anything(),
        expect.anything(),
      );
      expect(start).not.toHaveBeenCalled();
    },
  );
  it("does not reserve a legacy accepted receipt without its original route", async () => {
    const prepared = await prepareWorld({
      ...proposedWorld,
      selection: {
        direction_id: "paper",
        selected_by: "customer",
        decision_note: "Customer selected",
      },
    });
    const estimated = (await processPackOperation("owner", "estimate", {
      job_id: prepared.job.id,
    })) as any;
    const asset = fixture.saved.assets[0];
    asset.id = crypto.randomUUID();
    asset.status = "uncertain";
    asset.provider_state = { image_submission_0: { state: "accepted", request_id: "receipt" } };
    vi.mocked(runPackCommand).mockClear();
    await expect(
      processPackOperation("owner", "retry", {
        job_id: prepared.job.id,
        asset_id: asset.id,
        quote_id: estimated.job.quote.id,
        expected_revision: 1,
        approved_max_usd: estimated.job.quote.maximum_usd,
      }),
    ).rejects.toThrow(/reconcil|safe automatic retry/);
    expect(runPackCommand).not.toHaveBeenCalledWith(
      expect.anything(),
      "resume",
      expect.anything(),
      expect.anything(),
    );
  });
  it("retains a guided proposed board but cannot quote, spend or dispatch final production", async () => {
    const prepared = await prepareWorld(proposedWorld);
    expect(prepared.job.status).toBe("needs_input");
    expect(prepared.job.brief.creative_context.directions[0].board_url).toBe(
      "https://media.example/board.png",
    );
    await expect(
      processPackOperation("owner", "estimate", { job_id: prepared.job.id }),
    ).rejects.toThrow("Complete the saved brief");
    await expect(
      processPackOperation("owner", "generate", {
        job_id: prepared.job.id,
        quote_id: crypto.randomUUID(),
        expected_revision: 1,
        approved_max_usd: 1,
      }),
    ).rejects.toThrow("Pack brief is not ready");
    expect(importPackSources).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(vi.mocked(runPackCommand).mock.calls.some(([, action]) => action === "approve")).toBe(
      false,
    );
  });
  it.each(["guided", "autonomous"])(
    "uses the selected %s world without polluting the saved source inputs",
    async mode => {
      const selected_by = mode === "guided" ? "customer" : "agent";
      const prepared = await prepareWorld({
        ...proposedWorld,
        working_mode: mode,
        selection: {
          direction_id: "paper",
          selected_by,
          decision_note: "Selection captured in the continuing conversation",
        },
      });
      expect(prepared.readiness.ready).toBe(true);
      expect(prepared.job.brief.reference_image_urls).toEqual([]);
      const estimated = (await processPackOperation("owner", "estimate", {
        job_id: prepared.job.id,
      })) as any;
      expect(importPackSources).toHaveBeenCalledWith(
        "owner",
        expect.objectContaining({
          creative_direction: "Paper world: Cream paper, ink, quiet movement",
          reference_image_urls: ["https://media.example/artist.png"],
        }),
      );
      await processPackOperation("owner", "generate", {
        job_id: prepared.job.id,
        quote_id: estimated.job.quote.id,
        expected_revision: 1,
        approved_max_usd: estimated.job.quote.maximum_usd,
      });
      const result = (await processPackOperation("owner", "get", {
        job_id: prepared.job.id,
      })) as any;
      expect(result.job.status).toBe("completed");
      expect(result.assets[0].usable).toBe(true);
      expect(result.job.brief.creative_context.selection.selected_by).toBe(selected_by);
      expect(result.job.brief.reference_image_urls).toEqual([]);
    },
  );
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
