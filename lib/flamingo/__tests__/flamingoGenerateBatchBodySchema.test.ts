import { describe, it, expect } from "vitest";
import { flamingoGenerateBatchBodySchema } from "../flamingoGenerateBatchBodySchema";

const AUDIO = "https://example.com/song.mp3";

function prompts(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `q${i}`, prompt: `Question ${i}?` }));
}

describe("flamingoGenerateBatchBodySchema", () => {
  describe("defaults", () => {
    it("fills the generation defaults and a per-prompt token budget", () => {
      const result = flamingoGenerateBatchBodySchema.parse({
        audio_url: AUDIO,
        prompts: [{ id: "genre", prompt: "What genre is this?" }],
      });

      expect(result).toEqual({
        audio_url: AUDIO,
        prompts: [{ id: "genre", prompt: "What genre is this?", max_new_tokens: 400 }],
        temperature: 0.2,
        top_p: 1,
        do_sample: false,
      });
    });

    it("keeps explicit values", () => {
      const result = flamingoGenerateBatchBodySchema.parse({
        audio_url: AUDIO,
        prompts: [{ id: "lyrics", prompt: "Transcribe the lyrics.", max_new_tokens: 2048 }],
        temperature: 1.5,
        top_p: 0.9,
        do_sample: true,
      });

      expect(result).toMatchObject({
        prompts: [{ max_new_tokens: 2048 }],
        temperature: 1.5,
        top_p: 0.9,
        do_sample: true,
      });
    });
  });

  describe("limits", () => {
    it("accepts exactly 40 prompts", () => {
      expect(
        flamingoGenerateBatchBodySchema.safeParse({ audio_url: AUDIO, prompts: prompts(40) })
          .success,
      ).toBe(true);
    });

    it("accepts a 64-character id and a 4,000-character prompt", () => {
      const result = flamingoGenerateBatchBodySchema.safeParse({
        audio_url: AUDIO,
        prompts: [{ id: "a".repeat(64), prompt: "b".repeat(4000) }],
      });

      expect(result.success).toBe(true);
    });

    it.each([
      ["missing audio_url", { prompts: prompts(1) }, ["audio_url"], "audio_url is required"],
      ["audio_url not a URL", { audio_url: "nope", prompts: prompts(1) }, ["audio_url"]],
      ["missing prompts", { audio_url: AUDIO }, ["prompts"], "prompts is required"],
      ["no prompts", { audio_url: AUDIO, prompts: [] }, ["prompts"]],
      ["41 prompts", { audio_url: AUDIO, prompts: prompts(41) }, ["prompts"]],
      ["empty id", { audio_url: AUDIO, prompts: [{ id: "", prompt: "x" }] }, ["prompts", 0, "id"]],
      [
        "65-character id",
        { audio_url: AUDIO, prompts: [{ id: "a".repeat(65), prompt: "x" }] },
        ["prompts", 0, "id"],
      ],
      [
        "empty prompt",
        { audio_url: AUDIO, prompts: [{ id: "a", prompt: "" }] },
        ["prompts", 0, "prompt"],
      ],
      [
        "4,001-character prompt",
        { audio_url: AUDIO, prompts: [{ id: "a", prompt: "b".repeat(4001) }] },
        ["prompts", 0, "prompt"],
      ],
      [
        "max_new_tokens over 2048",
        { audio_url: AUDIO, prompts: [{ id: "a", prompt: "x", max_new_tokens: 2049 }] },
        ["prompts", 0, "max_new_tokens"],
      ],
      [
        "max_new_tokens of 0",
        { audio_url: AUDIO, prompts: [{ id: "a", prompt: "x", max_new_tokens: 0 }] },
        ["prompts", 0, "max_new_tokens"],
      ],
      [
        "temperature over 2",
        { audio_url: AUDIO, prompts: prompts(1), temperature: 2.1 },
        ["temperature"],
      ],
      ["top_p over 1", { audio_url: AUDIO, prompts: prompts(1), top_p: 1.1 }, ["top_p"]],
    ])("rejects %s", (_name, body, path, message?: string) => {
      const result = flamingoGenerateBatchBodySchema.safeParse(body);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toEqual(path);
      if (message) expect(result.error?.issues[0].message).toBe(message);
    });
  });

  describe("unique ids", () => {
    it("rejects a repeated id so every answer maps back to one prompt", () => {
      const result = flamingoGenerateBatchBodySchema.safeParse({
        audio_url: AUDIO,
        prompts: [
          { id: "genre", prompt: "What genre?" },
          { id: "genre", prompt: "What subgenre?" },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({
        path: ["prompts"],
        message: "prompt ids must be unique",
      });
    });
  });
});
