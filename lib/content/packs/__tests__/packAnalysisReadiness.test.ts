import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { createSignedFileUrlByKey } from "@/lib/supabase/storage/createSignedFileUrlByKey";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { preparePackProduction } from "../preparePackProduction";
import { fetchPackMedia } from "../fetchPackMedia";
import { withPackMediaRuntime } from "../withPackMediaRuntime";
import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../releasePackSchema";
import type { PackJob } from "../packTypes";

vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({ callFlamingoGenerate: vi.fn() }));
vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: vi.fn(),
}));
vi.mock("@/lib/supabase/release_pack_jobs/runPackCommand", () => ({ runPackCommand: vi.fn() }));
vi.mock("../fetchPackMedia", () => ({ fetchPackMedia: vi.fn() }));
vi.mock("../validatePackMediaBytes", () => ({ validatePackMediaBytes: vi.fn() }));
vi.mock("../withPackMediaRuntime", () => ({ withPackMediaRuntime: vi.fn() }));

const audio = {
  storage_key: "owner/release-packs/audio.wav",
  content_type: "audio/wav",
  bytes: 7,
  sha256: createHash("sha256").update("fixture").digest("hex"),
};
const analysis = {
  summary: "Sparse piano and soft percussion; lyrics are uncertain.",
  visual_direction: "Cream paper and ink typography with restrained motion.",
  proposed_start_seconds: 3,
};
const brief = releasePackBriefSchema.parse({
  artist_name: "Artist",
  song_title: "Song",
  audio_url: "https://example.com/song.wav",
  occasion: "rediscovery",
  allow_creative_defaults: true,
});
const deliverables = releasePackDeliverablesSchema.parse({});
const job = (context?: unknown): PackJob => ({
  id: "job",
  owner_id: "owner",
  created_by: "owner",
  revision: 1,
  status: "running",
  brief,
  deliverables,
  quote: {
    ...buildReleasePackQuote(brief, deliverables),
    id: "quote",
    revision: 1,
    expires_at: "2030-01-01T00:00:00Z",
    sources: { audio, references: [] },
  },
  production_context: context,
  held_credits: 100,
  consumed_credits: 0,
  workflow_run_id: null,
  error: null,
});
const complete = {
  state: "complete",
  audio,
  references: [],
  ...analysis,
  selected_start_seconds: 3,
  duration_seconds: 30,
};

describe("pack analysis readiness", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createSignedFileUrlByKey).mockResolvedValue("https://example.com/signed.wav");
    vi.mocked(fetchPackMedia).mockResolvedValue({
      bytes: Buffer.from("fixture"),
      contentType: "audio/wav",
    } as never);
    vi.mocked(withPackMediaRuntime).mockResolvedValue(30);
    vi.mocked(callFlamingoGenerate).mockResolvedValue({
      response: JSON.stringify(analysis),
    } as never);
  });

  const invalid = [
    "   ",
    "N/A",
    "unknown",
    "Not available",
    "Not applicable",
    "  NOT APPLICABLE  ",
  ].flatMap(text => ["summary", "visual_direction"].map(field => ({ field, text })));
  it.each(invalid)(
    "rejects fresh placeholder $field: $text before saving completed context",
    async ({ field, text }) => {
      vi.mocked(callFlamingoGenerate).mockResolvedValue({
        response: JSON.stringify({ ...analysis, [field]: text }),
      } as never);
      await expect(preparePackProduction({ accountId: "owner" }, job())).rejects.toThrow();
      expect(callFlamingoGenerate).toHaveBeenCalledTimes(1);
      expect(runPackCommand).not.toHaveBeenCalledWith(expect.anything(), "context", "job", {
        value: expect.objectContaining({ state: "complete" }),
      });
    },
  );
  it.each(invalid)(
    "holds saved placeholder $field: $text for reconciliation without another model call",
    async ({ field, text }) => {
      const saved = { ...complete, [field]: text };
      await expect(preparePackProduction({ accountId: "owner" }, job(saved))).rejects.toThrow(
        /reconcil/i,
      );
      expect(callFlamingoGenerate).not.toHaveBeenCalled();
      expect(fetchPackMedia).not.toHaveBeenCalled();
      expect(createSignedFileUrlByKey).not.toHaveBeenCalled();
      expect(runPackCommand).not.toHaveBeenCalled();
      expect(saved).toEqual({ ...complete, [field]: text });
    },
  );
  it("accepts descriptive uncertainty and retains an explicit customer direction", async () => {
    const input = job();
    input.brief = { ...brief, creative_direction: "Customer-selected blue collage" };
    const result = await preparePackProduction({ accountId: "owner" }, input);
    expect(result.brief.creative_direction).toBe(input.brief.creative_direction);
    expect(result.brief.song_summary).toContain(analysis.summary);
    expect(result.brief.audio_start_seconds).toBe(3);
    expect(runPackCommand).toHaveBeenCalledWith(expect.anything(), "context", "job", {
      value: expect.objectContaining({ state: "complete", summary: analysis.summary }),
    });
  });
  it("preserves meaningful observations containing the words not applicable", async () => {
    const descriptive = {
      ...analysis,
      summary:
        "Vocal analysis is not applicable to this instrumental; sparse piano and soft percussion dominate.",
      visual_direction:
        "Lyric typography is not applicable; use cream paper and restrained abstract motion.",
    };
    vi.mocked(callFlamingoGenerate).mockResolvedValue({
      response: JSON.stringify(descriptive),
    } as never);
    expect(
      (await preparePackProduction({ accountId: "owner" }, job())).brief.song_summary,
    ).toContain(descriptive.summary);
    expect(
      (await preparePackProduction({ accountId: "owner" }, job({ ...complete, ...descriptive })))
        .brief.song_summary,
    ).toContain(descriptive.summary);
  });
  it("reuses valid saved analysis and does not repeat an uncertain analysis", async () => {
    expect(
      (await preparePackProduction({ accountId: "owner" }, job(complete))).brief.song_summary,
    ).toContain(analysis.summary);
    await expect(
      preparePackProduction({ accountId: "owner" }, job({ state: "analyzing" })),
    ).rejects.toThrow(/reconcil/i);
    expect(callFlamingoGenerate).not.toHaveBeenCalled();
    expect(runPackCommand).not.toHaveBeenCalled();
  });
});
