import { beforeEach, expect, it, vi } from "vitest";
import { generateSiteMedia } from "../assets/generateSiteMedia";
const m = vi.hoisted(() => ({ image: vi.fn(), fal: vi.fn(), video: vi.fn() }));
vi.mock("ai", () => ({ generateImage: m.image }));
vi.mock("@/lib/fal/server", () => ({ default: { subscribe: m.fal } }));
vi.mock("@/lib/higgsfield/generateSiteVideo", () => ({ generateSiteVideo: m.video }));
const asset = {
  name: "world",
  purpose: "scene",
  prompt: "glass moon",
  aspectRatio: "16:9" as const,
};
beforeEach(() => {
  vi.resetAllMocks();
});
it("uses Nano Banana edit when supplied reference artwork must be preserved", async () => {
  m.fal.mockResolvedValue({
    data: { images: [{ url: "https://fal.media/result.webp" }] },
    requestId: "f1",
  });
  const result = await generateSiteMedia(
    {
      ...asset,
      production: { model: "nano-banana-pro", rationale: "Preserve character identity" },
    },
    ["https://art.test/cover.webp"],
  );
  expect(m.fal.mock.calls[0][0]).toBe("fal-ai/nano-banana-pro/edit");
  expect(m.fal.mock.calls[0][1].input).toMatchObject({
    resolution: "2K",
    image_urls: ["https://art.test/cover.webp"],
  });
  expect(result.generation.rationale).toBe("Preserve character identity");
  expect(m.image).not.toHaveBeenCalled();
});
it("uses Gateway GPT Image 2 with references and no SDK retries", async () => {
  m.image.mockResolvedValue({
    image: { uint8Array: new Uint8Array([1]) },
    responses: [{ headers: { "x-request-id": "g1" } }],
    usage: {},
  });
  const result = await generateSiteMedia(
    { ...asset, production: { model: "gpt-image-2", rationale: "Precise material composition" } },
    ["https://art.test/cover.webp"],
  );
  expect(m.image.mock.calls[0][0]).toMatchObject({
    model: "openai/gpt-image-2",
    size: "1536x1024",
    maxRetries: 0,
    prompt: { images: ["https://art.test/cover.webp"] },
  });
  expect(result.generation.requestId).toBe("g1");
});
it("does not silently substitute another model on failure", async () => {
  m.video.mockRejectedValue(new Error("Seedance pending"));
  await expect(
    generateSiteMedia(
      { ...asset, production: { model: "seedance-2.5", rationale: "Cinematic reveal" } },
      [],
    ),
  ).rejects.toThrow("Seedance pending");
  expect(m.image).not.toHaveBeenCalled();
  expect(m.fal).not.toHaveBeenCalled();
});
