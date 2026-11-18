import { afterEach, expect, it, vi } from "vitest";
import { releasePackWorkflow } from "@/app/workflows/packs/releasePackWorkflow";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import fal from "@/lib/fal/server";
import { generateText } from "ai";
import { composePackMedia } from "../composePackMedia";
import { inspectPackMedia } from "../inspectPackMedia";
import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../releasePackSchema";
import * as evidence from "../getPackModelEvidence";
vi.mock("workflow", () => ({ getWorkflowMetadata: () => ({ workflowRunId: "saved-workflow" }) }));
vi.mock("@/lib/supabase/release_pack_jobs/runPackCommand", () => ({ runPackCommand: vi.fn() }));
vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: vi.fn(async ({ key }) => `https://example.invalid/${key}`),
}));
vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({ callFlamingoGenerate: vi.fn() }));
vi.mock("@/lib/fal/server", () => ({
  default: { queue: { submit: vi.fn(), status: vi.fn(), result: vi.fn() } },
}));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("../composePackMedia", () => ({ composePackMedia: vi.fn() }));
vi.mock("../inspectPackMedia", () => ({ inspectPackMedia: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
it("runs actual workflow preparation, accepted polling, local composition and settlement after unrelated evidence changes", async () => {
  const brief = releasePackBriefSchema.parse({
    artist_name: "Fixture",
    song_title: "Song",
    occasion: "rediscovery",
    audio_url: "https://example.invalid/song.wav",
    allow_creative_defaults: true,
  });
  const deliverables = releasePackDeliverablesSchema.parse({
    videos: 0,
    artwork: 1,
    quote_cards: 0,
    carousels: 0,
    visualizers: 0,
  });
  const { model_readiness: _assessment, ...quote } = buildReleasePackQuote(brief, deliverables);
  const changed = evidence.getPackModelEvidence();
  changed.version = "changed-after-approval";
  changed.tasks.motion.commercial_basis = "restricted";
  changed.tasks.motion.valid_until = "2000-01-01T00:00:00Z";
  // Even a new restriction on this provider cannot resubmit or erase an accepted receipt.
  changed.tasks.image.commercial_basis = "restricted";
  vi.spyOn(evidence, "getPackModelEvidence").mockReturnValue(changed);
  const asset = {
    id: "asset",
    kind: "artwork",
    ordinal: 0,
    status: "uncertain",
    provider_state: {
      image_submission_0: {
        state: "accepted",
        request_id: "retained",
        model: "original-image-route",
        charge_credits: 73,
        input_sha256: "original-input",
      },
      caption: "Retained caption",
    },
  } as any;
  const saved = {
    job: {
      id: "job",
      owner_id: "owner",
      revision: 1,
      status: "running",
      held_credits: 73,
      consumed_credits: 0,
      brief,
      deliverables,
      quote: { ...quote, id: "quote", fingerprint: "original-approved-fingerprint" },
      production_context: {
        state: "complete",
        audio: { storage_key: "owner/release-packs/song.wav" },
        references: [],
        summary: "Sparse piano and percussion",
        visual_direction: "Cream paper and ink",
        proposed_start_seconds: 0,
        selected_start_seconds: 0,
        duration_seconds: 30,
      },
    },
    assets: [asset],
  };
  vi.mocked(runPackCommand).mockImplementation(async (_actor, command, _job, input = {}) => {
    if (command === "phase") asset.provider_state[input.phase as string] = input.value;
    if (command === "finish_asset") Object.assign(asset, input);
    if (command === "settle") {
      // Synthetic ledger only: assert original receipt amount is handed to the existing settlement path.
      expect(asset.provider_state.image_submission_0.charge_credits).toBe(73);
      expect(asset.status).toBe("completed");
      saved.job.held_credits = 0;
      saved.job.consumed_credits = 73;
    }
    return saved as never;
  });
  vi.mocked(fal.queue.status).mockResolvedValue({ status: "COMPLETED" } as never);
  vi.mocked(fal.queue.result).mockResolvedValue({
    data: { images: [{ url: "https://example.invalid/retained.png" }] },
  } as never);
  vi.mocked(composePackMedia).mockResolvedValue({
    files: [{ storage_key: "owner/release-packs/final.png", content_type: "image/png", bytes: 10 }],
    probe: {},
  });
  vi.mocked(inspectPackMedia).mockResolvedValue({ passed: true, reason: "Synthetic QA" });
  expect(await releasePackWorkflow({ accountId: "owner" }, "job", "asset")).toEqual({
    job_id: "job",
  });
  expect(fal.queue.status).toHaveBeenCalledWith("original-image-route", {
    requestId: "retained",
    logs: false,
  });
  expect(fal.queue.result).toHaveBeenCalledWith("original-image-route", { requestId: "retained" });
  expect(fal.queue.submit).not.toHaveBeenCalled();
  expect(callFlamingoGenerate).not.toHaveBeenCalled();
  expect(generateText).not.toHaveBeenCalled();
  expect(composePackMedia).toHaveBeenCalledOnce();
  expect(inspectPackMedia).toHaveBeenCalledOnce();
  expect(asset.caption).toBe("Retained caption");
  expect(saved.job.quote.fingerprint).toBe("original-approved-fingerprint");
  expect(saved.job.consumed_credits).toBe(73);
  const commands = vi.mocked(runPackCommand).mock.calls.map(call => call[1]);
  expect(commands.slice(0, 3)).toEqual(["run", "read", "read"]);
  expect(commands.slice(-2)).toEqual(["finish_asset", "settle"]);
  expect(commands).not.toContain("approve");
  expect(commands).not.toContain("claim");
  expect(commands).not.toContain("context");
});
