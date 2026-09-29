import { beforeEach, expect, it, vi } from "vitest";
import { NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { generateSiteObject } from "../generateSiteObject";
const generate = vi.hoisted(() => vi.fn());
const stream = vi.hoisted(() => vi.fn());
vi.mock("ai", async importOriginal => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateObject: generate,
  streamObject: stream,
}));
vi.mock("@/lib/credits/handleChatCredits", () => ({ handleChatCredits: vi.fn() }));
vi.mock("../production/requireCredits", () => ({ requireCredits: vi.fn() }));
beforeEach(() => {
  generate.mockReset();
  stream.mockReset();
});
const schema = z.object({ motion: z.string().max(5) });
function invalid() {
  return new NoObjectGeneratedError({
    cause: schema.safeParse({ motion: "too long" }).error,
    text: JSON.stringify({ motion: "too long" }),
    response: { id: "response", timestamp: new Date(), modelId: "test" },
    usage: {
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
      inputTokenDetails: { noCacheTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
      outputTokenDetails: { textTokens: 2, reasoningTokens: 0 },
    },
    finishReason: "stop",
  });
}
it("repairs an invalid structured result once using the failing field and original result", async () => {
  generate.mockRejectedValueOnce(invalid()).mockResolvedValueOnce({ object: { motion: "snap" } });
  const result = await generateSiteObject({
    model: "test",
    schema,
    prompt: "Build the selected world",
  });
  expect(result.object.motion).toBe("snap");
  expect(generate).toHaveBeenCalledTimes(2);
  expect(generate.mock.calls[1][0].messages.at(-1).content).toContain('"motion"');
  expect(generate.mock.calls[1][0].messages.at(-1).content).toContain("too_big");
  expect(generate.mock.calls[1][0].maxRetries).toBe(0);
});
it("does not retry provider errors or loop after a failed schema repair", async () => {
  generate.mockRejectedValueOnce(new Error("Provider unavailable"));
  await expect(generateSiteObject({ model: "test", schema, prompt: "Build" })).rejects.toThrow(
    "Provider unavailable",
  );
  expect(generate).toHaveBeenCalledTimes(1);
  generate.mockReset().mockRejectedValue(invalid());
  await expect(
    generateSiteObject({ model: "test", schema, prompt: "Build" }),
  ).rejects.toMatchObject({ name: "AI_NoObjectGeneratedError" });
  expect(generate).toHaveBeenCalledTimes(2);
});

it("consumes streaming output and returns only the validated final object and usage", async () => {
  let drained = false;
  stream.mockReturnValue({
    fullStream: (async function* () {
      yield { type: "text-delta", textDelta: "partial" };
      drained = true;
    })(),
    object: Promise.resolve({ motion: "snap" }),
    usage: Promise.resolve({ totalTokens: 3 }),
  });
  const result = await generateSiteObject(
    { model: "test", schema, prompt: "Build" },
    undefined,
    undefined,
    true,
  );
  expect(drained).toBe(true);
  expect(result.object).toEqual({ motion: "snap" });
  expect(result.usage).toEqual({ totalTokens: 3 });
  expect(generate).not.toHaveBeenCalled();
});
it("propagates stream failure without retrying the paid request", async () => {
  stream.mockReturnValue({
    fullStream: (async function* () {
      yield { type: "error", error: new Error("Stream interrupted") };
    })(),
    object: new Promise(() => {}),
    usage: new Promise(() => {}),
  });
  await expect(
    generateSiteObject({ model: "test", schema, prompt: "Build" }, undefined, undefined, true),
  ).rejects.toThrow("Stream interrupted");
  expect(stream).toHaveBeenCalledTimes(1);
});
