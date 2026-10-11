import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const { createImageBodySchema } = await import("../validateCreateImageBody");
const { buildImageInput } = await import("../buildImageInput");

describe("createImageBodySchema", () => {
  it("rejects an explicitly empty prompt", () => {
    const result = createImageBodySchema.safeParse({ prompt: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a non-empty prompt", () => {
    const result = createImageBodySchema.safeParse({ prompt: "a neon skyline" });
    expect(result.success).toBe(true);
  });

  it("still allows an omitted prompt", () => {
    const result = createImageBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("safely translates legacy reference fields and preserves every URL for editing", () => {
    const parsed = createImageBodySchema.parse({
      prompt: "an artist portrait",
      image_urls: ["https://x.test/current.png"],
      reference_image_url: "https://x.test/face.png",
      images: ["https://x.test/other.png", "https://x.test/face.png"],
    });
    expect(buildImageInput(parsed)).toMatchObject({
      model: "meta/muse-image/edit",
      input: {
        image_urls: [
          "https://x.test/current.png",
          "https://x.test/face.png",
          "https://x.test/other.png",
        ],
      },
    });
    expect(parsed).not.toHaveProperty("reference_image_url");
    expect(parsed).not.toHaveProperty("images");
  });

  it("rejects unsupported model and editing controls instead of stripping them", () => {
    expect(
      createImageBodySchema.safeParse({ prompt: "portrait", model: "arbitrary/model" }).success,
    ).toBe(false);
    expect(
      createImageBodySchema.safeParse({ prompt: "portrait", mask_url: "https://x.test/mask.png" })
        .success,
    ).toBe(false);
  });

  it("rejects invalid or too many combined reference URLs", () => {
    expect(createImageBodySchema.safeParse({ reference_image_url: "not-a-url" }).success).toBe(
      false,
    );
    expect(
      createImageBodySchema.safeParse({
        image_urls: Array.from({ length: 10 }, (_, i) => `https://x.test/${i}.png`),
        images: ["https://x.test/extra.png"],
      }).success,
    ).toBe(false);
  });
});
