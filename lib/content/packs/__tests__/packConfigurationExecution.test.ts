import { beforeEach, describe, expect, it, vi } from "vitest";
import fal from "@/lib/fal/server";
import { generateText } from "ai";
import { createPackProductionServices } from "../createPackProductionServices";
import { preparePackProduction } from "../preparePackProduction";
import { callFlamingoGenerate } from "@/lib/flamingo/callFlamingoGenerate";
import { buildReleasePackQuote } from "../buildReleasePackQuote";
import { releasePackBriefSchema, releasePackDeliverablesSchema } from "../releasePackSchema";
import { runPackCommand } from "@/lib/supabase/release_pack_jobs/runPackCommand";
import { composePackMedia } from "../composePackMedia";
import { inspectPackMedia } from "../inspectPackMedia";
vi.mock("@/lib/fal/server", () => ({
  default: { queue: { submit: vi.fn(), status: vi.fn(), result: vi.fn() } },
}));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@/lib/supabase/release_pack_jobs/runPackCommand", () => ({ runPackCommand: vi.fn() }));
vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: vi.fn(),
}));
vi.mock("@/lib/flamingo/callFlamingoGenerate", () => ({ callFlamingoGenerate: vi.fn() }));
vi.mock("../composePackMedia", () => ({ composePackMedia: vi.fn() }));
vi.mock("../inspectPackMedia", () => ({ inspectPackMedia: vi.fn() }));
vi.mock("../withPackMediaRuntime", () => ({ withPackMediaRuntime: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const brief = releasePackBriefSchema.parse({
  artist_name: "Fixture",
  song_title: "Song",
  occasion: "rediscovery",
  audio_url: "https://example.com/song.wav",
  allow_creative_defaults: true,
});
const deliverables = releasePackDeliverablesSchema.parse({});
function fixture(state: Record<string, unknown> = {}, valid = false) {
  const job = {
    id: "job",
    owner_id: "owner",
    brief,
    deliverables,
    quote: valid ? buildReleasePackQuote(brief, deliverables) : {},
  } as any;
  const asset = { id: "asset", provider_state: state } as any;
  return { job, state, services: createPackProductionServices({ accountId: "owner" }, job, asset) };
}
describe("configuration guard at production boundaries", () => {
  it("blocks each new provider stage on an unbound quote", async () => {
    const { job, services } = fixture();
    await expect(preparePackProduction({ accountId: "owner" }, job)).rejects.toThrow(
      /new estimate/,
    );
    await expect(services.generateImages("prompt", 1)).rejects.toThrow(/new estimate/);
    await expect(services.generateMotion("prompt", "image")).rejects.toThrow(/new estimate/);
    await expect(services.caption("prompt")).rejects.toThrow(/new estimate/);
    expect(() => services.compose({} as any)).toThrow(/new estimate/);
    expect(() => services.inspect({} as any)).toThrow(/new estimate/);
    for (const mock of [
      fal.queue.submit,
      fal.queue.status,
      generateText,
      callFlamingoGenerate,
      runPackCommand,
      composePackMedia,
      inspectPackMedia,
    ])
      expect(mock).not.toHaveBeenCalled();
  });
  it("polls an accepted request on its saved route then stops the next unstarted stage", async () => {
    const { services } = fixture({
      image_submission_0: {
        state: "accepted",
        request_id: "accepted",
        model: "original-route",
        charge_credits: 100,
      },
    });
    vi.mocked(fal.queue.status).mockResolvedValue({ status: "COMPLETED" } as never);
    vi.mocked(fal.queue.result).mockResolvedValue({
      data: { images: [{ url: "https://example.com/saved.png" }] },
    } as never);
    expect(await services.generateImages("new prompt", 1)).toEqual([
      "https://example.com/saved.png",
    ]);
    expect(fal.queue.status).toHaveBeenCalledWith("original-route", {
      requestId: "accepted",
      logs: false,
    });
    expect(fal.queue.submit).not.toHaveBeenCalled();
    await expect(services.caption("prompt")).rejects.toThrow(/new estimate/);
    expect(generateText).not.toHaveBeenCalled();
  });
  it("does not use one accepted carousel slide to authorize new slides", async () => {
    const { services } = fixture({
      image_submission_0: {
        state: "complete",
        data: { images: [{ url: "https://example.com/saved.png" }] },
      },
    });
    await expect(services.generateImages("prompt", 4)).rejects.toThrow(/new estimate/);
    expect(fal.queue.submit).not.toHaveBeenCalled();
  });
  it("allows new work with the exact supported configuration", async () => {
    const { services } = fixture({}, true);
    vi.mocked(fal.queue.submit).mockResolvedValue({ request_id: "new" } as never);
    vi.mocked(fal.queue.status).mockResolvedValue({ status: "COMPLETED" } as never);
    vi.mocked(fal.queue.result).mockResolvedValue({
      data: { images: [{ url: "https://example.com/new.png" }] },
    } as never);
    await services.generateImages("prompt", 1);
    expect(fal.queue.submit).toHaveBeenCalledTimes(1);
  });
});
