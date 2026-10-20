import { describe, it, expect, vi } from "vitest";
import { producePackAsset } from "../producePackAsset";
import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../releasePackSchema";
const brief = releasePackBriefSchema.parse({
  artist_name: "Grace",
  song_title: "I Wish",
  audio_url: "https://example.com/original.mp3",
  occasion: "rediscovery",
  creative_direction: "blue collage",
});
const job = {
  id: "job",
  owner_id: "owner",
  created_by: "owner",
  revision: 1,
  status: "running",
  brief,
  deliverables: releasePackDeliverablesSchema.parse({}),
  quote: null,
  held_credits: 0,
  consumed_credits: 0,
  workflow_run_id: null,
  error: null,
};
const asset = {
  id: "asset",
  job_id: "job",
  kind: "video" as const,
  ordinal: 0,
  status: "running" as const,
  attempt: 1,
  credits: 100,
  maximum_usd: 1,
  provider_state: {},
  files: [],
  caption: null,
  qa: null,
  error: null,
};
describe("durable asset execution", () => {
  it("carries exact source audio into composition and only completes after real QA", async () => {
    const finish = vi.fn();
    const compose = vi.fn(async (_input: { audioUrl: string }) => ({
      files: [{ storage_key: "out.mp4", content_type: "video/mp4", bytes: 100 }],
      probe: { duration: 8, audio: true },
    }));
    const services = {
      phase: vi.fn(),
      generateImages: vi.fn(async () => ["https://example.com/still.jpg"]),
      generateMotion: vi.fn(async () => "https://example.com/motion.mp4"),
      caption: vi.fn(async () => "Rediscover I Wish."),
      compose,
      inspect: vi.fn(async () => ({ passed: true, reason: "matches brief" })),
      finish,
    };
    await producePackAsset(job as never, asset, services);
    expect(compose.mock.calls[0][0].audioUrl).toBe(brief.audio_url);
    expect(services.inspect).toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        caption: "Rediscover I Wish.",
        qa: expect.objectContaining({ passed: true }),
      }),
    );
  });
  it("retains a rejected output and never reports it usable", async () => {
    const finish = vi.fn();
    const services = {
      phase: vi.fn(),
      generateImages: vi.fn(async () => ["https://example.com/still.jpg"]),
      generateMotion: vi.fn(async () => "https://example.com/motion.mp4"),
      caption: vi.fn(async () => "caption"),
      compose: vi.fn(async () => ({ files: [], probe: { duration: 8, audio: true } })),
      inspect: vi.fn(async () => ({ passed: false, reason: "wrong identity" })),
      finish,
    };
    await producePackAsset(job as never, asset, services);
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", qa: expect.objectContaining({ passed: false }) }),
    );
  });
  it("reuses persisted completed phases on resume", async () => {
    const services = {
      phase: vi.fn(),
      generateImages: vi.fn(),
      generateMotion: vi.fn(),
      caption: vi.fn(),
      compose: vi.fn(),
      inspect: vi.fn(async () => ({ passed: true, reason: "ok" })),
      finish: vi.fn(),
    };
    await producePackAsset(
      job as never,
      {
        ...asset,
        provider_state: {
          images: ["https://example.com/a.jpg"],
          motion: "https://example.com/v.mp4",
          caption: "saved",
          composition: { files: [], probe: { duration: 8, audio: true } },
        },
      },
      services,
    );
    expect(services.generateImages).not.toHaveBeenCalled();
    expect(services.generateMotion).not.toHaveBeenCalled();
    expect(services.compose).not.toHaveBeenCalled();
  });
});
