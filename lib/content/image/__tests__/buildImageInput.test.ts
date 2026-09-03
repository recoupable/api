import { describe, it, expect } from "vitest";
import { buildImageInput } from "@/lib/content/image/buildImageInput";
import type { ValidatedCreateImageBody } from "@/lib/content/image/validateCreateImageBody";

const base: ValidatedCreateImageBody = {
  accountId: "acc-1",
  num_images: 1,
  output_format: "webp",
  sync_mode: false,
};

describe("buildImageInput", () => {
  it("uses the text-to-image model with no reference images", () => {
    const { model, input } = buildImageInput({ ...base, prompt: "a moody portrait" });
    expect(model).toBe("meta/muse-image/text-to-image");
    expect(input).toEqual({
      prompt: "a moody portrait",
      num_images: 1,
      output_format: "webp",
      sync_mode: false,
    });
  });

  it("uses the edit model and forwards image_urls when reference images are given", () => {
    const { model, input } = buildImageInput({
      ...base,
      prompt: "make it moodier",
      image_urls: ["https://example.com/ref.png"],
    });
    expect(model).toBe("meta/muse-image/edit");
    expect(input.image_urls).toEqual(["https://example.com/ref.png"]);
  });

  it("falls back to a default prompt when none is given", () => {
    expect(buildImageInput(base).input.prompt).toBe("portrait photo, natural lighting");
  });

  it("only sends aspect_ratio when provided — Muse Image auto-chooses otherwise", () => {
    expect("aspect_ratio" in buildImageInput(base).input).toBe(false);
    expect(buildImageInput({ ...base, aspect_ratio: "16:9" }).input.aspect_ratio).toBe("16:9");
  });

  it("never sends resolution, safety_tolerance, enable_web_search, or thinking_level — not Muse Image params", () => {
    const { input } = buildImageInput(base);
    for (const key of ["resolution", "safety_tolerance", "enable_web_search", "thinking_level"]) {
      expect(key in input).toBe(false);
    }
  });
});
