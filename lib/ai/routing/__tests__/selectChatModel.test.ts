import { afterEach, describe, expect, it, vi } from "vitest";
import { experimental_evaluate as evaluate } from "ai-evaluation";
import { selectChatModel } from "../selectChatModel";
vi.mock("ai-evaluation", () => ({ experimental_evaluate: vi.fn() }));

const messages = [
  { id: "u", role: "user" as const, parts: [{ type: "text" as const, text: "Hello" }] },
];
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const mockChoice = (choice: string, confidence = 0.9) => {
  const mock = vi.mocked(evaluate);
  mock.mockReset();
  mock.mockResolvedValue({
    answers: {
      tier: {
        choice,
        probabilities: { fast: 0.05, balanced: 0.05, frontier: 0.05, [choice]: confidence },
      },
    },
  } as never);
  return mock;
};
describe("selectChatModel", () => {
  it("preserves manual choices without calling Jev", async () => {
    const fetch = mockChoice("fast");
    expect(await selectChatModel("openai/gpt-5.5", messages)).toEqual({
      modelId: "openai/gpt-5.5",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    ["fast", "google/gemini-3.5-flash-lite"],
    ["balanced", "moonshotai/kimi-k3"],
    ["frontier", "anthropic/claude-opus-4.8"],
  ])("routes %s to an allowlisted model", async (tier, modelId) => {
    mockChoice(tier);
    expect(await selectChatModel("auto", messages)).toMatchObject({
      modelId,
      routing: { source: "jev", tier, confidence: 0.9 },
    });
  });
  it("escalates uncertain decisions to frontier", async () => {
    mockChoice("fast", 0.2);
    expect(await selectChatModel("auto", messages)).toMatchObject({
      routing: { tier: "frontier", source: "fallback" },
    });
  });
  it("falls back when Gateway authentication fails", async () => {
    mockChoice("fast").mockRejectedValue(new Error("Authentication failed"));
    expect(await selectChatModel("auto", messages)).toMatchObject({
      modelId: "moonshotai/kimi-k3",
      routing: { source: "fallback" },
    });
  });
  it("rejects unknown model choices", async () => {
    mockChoice("attacker/model");
    expect(await selectChatModel("auto", messages)).toMatchObject({
      modelId: "moonshotai/kimi-k3",
      routing: { source: "fallback" },
    });
  });
  it("continues after a timeout", async () => {
    mockChoice("fast").mockRejectedValue(new DOMException("Timeout", "TimeoutError"));
    expect(await selectChatModel("auto", messages)).toMatchObject({
      routing: { source: "fallback" },
    });
  });
  it("uses frontier for attachments without sending files to Jev", async () => {
    const fetch = mockChoice("fast");
    const input = [
      {
        ...messages[0],
        parts: [
          { type: "file" as const, mediaType: "image/png", url: "https://example.com/private.png" },
        ],
      },
    ];
    expect(await selectChatModel("auto", input)).toMatchObject({
      routing: { tier: "frontier", source: "fallback" },
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("bounds routing context and never sends tool outputs", async () => {
    const fetch = mockChoice("balanced");
    await selectChatModel("auto", [
      ...messages,
      { id: "a", role: "assistant", parts: [{ type: "text", text: "x".repeat(40000) }] },
    ]);
    const body = fetch.mock.calls[0][0];
    expect((body.state as string).length).toBeLessThanOrEqual(24000);
    expect(body.abortSignal).toBeInstanceOf(AbortSignal);
  });
  it("keeps Gateway routing cost and uses TypeSafe's reported confidence", async () => {
    mockChoice("fast").mockResolvedValue({
      answers: {
        tier: { choice: "fast", probabilities: { fast: 0.8, balanced: 0.1, frontier: 0.1 } },
      },
      providerMetadata: { typesafe: { confidence: { tier: 0.5 } }, gateway: { cost: "0.00002" } },
    } as never);
    expect(await selectChatModel("auto", messages)).toMatchObject({
      routing: { tier: "frontier", confidence: 0.5, costUsd: 0.00002 },
    });
  });
});
