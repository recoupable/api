import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseContentPrompt } from "../parseContentPrompt";
import type { ContentPromptFlags } from "../parseContentPrompt";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn(() => "mocked-output"),
  },
}));

vi.mock("@/lib/const", () => ({
  LIGHTWEIGHT_MODEL: "test-model",
}));

const { generateText } = await import("ai");

describe("parseContentPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts lipsync=true when the prompt mentions lipsync", async () => {
    const flags: ContentPromptFlags = {
      lipsync: true,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    };
    vi.mocked(generateText).mockResolvedValue({ output: flags } as never);

    const result = await parseContentPrompt("make me a lipsync video");

    expect(result.lipsync).toBe(true);
  });

  it("extracts lipsync=false when the prompt does not mention lipsync", async () => {
    const flags: ContentPromptFlags = {
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    };
    vi.mocked(generateText).mockResolvedValue({ output: flags } as never);

    const result = await parseContentPrompt("make me a video");

    expect(result.lipsync).toBe(false);
  });

  it("extracts batch count from prompt", async () => {
    const flags: ContentPromptFlags = {
      lipsync: false,
      batch: 5,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    };
    vi.mocked(generateText).mockResolvedValue({ output: flags } as never);

    const result = await parseContentPrompt("make me 5 videos");

    expect(result.batch).toBe(5);
  });

  it("extracts captionLength from prompt", async () => {
    const flags: ContentPromptFlags = {
      lipsync: false,
      batch: 1,
      captionLength: "long",
      upscale: false,
      template: "artist-caption-bedroom",
    };
    vi.mocked(generateText).mockResolvedValue({ output: flags } as never);

    const result = await parseContentPrompt("make a video with a long caption");

    expect(result.captionLength).toBe("long");
  });

  it("extracts upscale from prompt", async () => {
    const flags: ContentPromptFlags = {
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: true,
      template: "artist-caption-bedroom",
    };
    vi.mocked(generateText).mockResolvedValue({ output: flags } as never);

    const result = await parseContentPrompt("make a high quality video");

    expect(result.upscale).toBe(true);
  });

  it("extracts template from prompt", async () => {
    const flags: ContentPromptFlags = {
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-stage",
    };
    vi.mocked(generateText).mockResolvedValue({ output: flags } as never);

    const result = await parseContentPrompt("make a concert video on stage");

    expect(result.template).toBe("artist-caption-stage");
  });

  it("passes the user prompt as the user message to generateText", async () => {
    const flags: ContentPromptFlags = {
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    };
    vi.mocked(generateText).mockResolvedValue({ output: flags } as never);

    await parseContentPrompt("make me a cool video");

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: "make me a cool video",
          }),
        ]),
      }),
    );
  });

  it("returns defaults when generateText throws", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("AI Gateway down"));

    const result = await parseContentPrompt("make me a lipsync video");

    expect(result).toEqual({
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
  });

  it("returns defaults when output is null", async () => {
    vi.mocked(generateText).mockResolvedValue({ output: null } as never);

    const result = await parseContentPrompt("make me a video");

    expect(result).toEqual({
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    });
  });
});
