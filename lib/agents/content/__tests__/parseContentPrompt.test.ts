import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseContentPrompt } from "../parseContentPrompt";
import type { ContentPromptFlags } from "../parseContentPrompt";

const mockGenerate = vi.fn();

vi.mock("../createContentPromptAgent", () => ({
  createContentPromptAgent: vi.fn(() => ({
    generate: mockGenerate,
  })),
}));

vi.mock("@/lib/content/contentTemplates", () => ({
  DEFAULT_CONTENT_TEMPLATE: "artist-caption-bedroom",
}));

const { createContentPromptAgent } = await import("../createContentPromptAgent");

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
    mockGenerate.mockResolvedValue({ output: flags });

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
    mockGenerate.mockResolvedValue({ output: flags });

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
    mockGenerate.mockResolvedValue({ output: flags });

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
    mockGenerate.mockResolvedValue({ output: flags });

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
    mockGenerate.mockResolvedValue({ output: flags });

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
    mockGenerate.mockResolvedValue({ output: flags });

    const result = await parseContentPrompt("make a concert video on stage");

    expect(result.template).toBe("artist-caption-stage");
  });

  it("creates a new agent and calls generate with the prompt", async () => {
    const flags: ContentPromptFlags = {
      lipsync: false,
      batch: 1,
      captionLength: "short",
      upscale: false,
      template: "artist-caption-bedroom",
    };
    mockGenerate.mockResolvedValue({ output: flags });

    await parseContentPrompt("make me a cool video");

    expect(createContentPromptAgent).toHaveBeenCalledOnce();
    expect(mockGenerate).toHaveBeenCalledWith({ prompt: "make me a cool video" });
  });

  it("returns defaults when agent.generate throws", async () => {
    mockGenerate.mockRejectedValue(new Error("AI Gateway down"));

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
    mockGenerate.mockResolvedValue({ output: null });

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
