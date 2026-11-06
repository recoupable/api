import { afterEach, describe, expect, it, vi } from "vitest";
import { createGateway } from "ai";
import { z } from "zod";
import { generateContextObject } from "../generateContextObject";

/** Real `ai` + AI Gateway client against a fake fetch: no network and no paid call. */
function fakeGateway(body: Record<string, unknown>) {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: JSON.stringify({ label: "ok" }) }],
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
          warnings: [],
          ...body,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  globalThis.AI_SDK_DEFAULT_PROVIDER = createGateway({
    apiKey: "test-not-a-key",
    baseURL: "http://127.0.0.1:9/v1/ai",
    fetch,
  });
  return fetch;
}
const generate = () =>
  generateContextObject({ system: "s", input: {}, schema: z.object({ label: z.string() }) });

afterEach(() => {
  globalThis.AI_SDK_DEFAULT_PROVIDER = undefined;
});

describe("generateContextObject model trace", () => {
  it("records the model the gateway body reports, not the echoed request id", async () => {
    const fetch = fakeGateway({
      response: { id: "r", modelId: "openai/gpt-5", timestamp: new Date(0).toISOString() },
    });
    const result = await generate();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.content).toEqual({ label: "ok" });
    expect(result.trace).toMatchObject({
      model: "openai/gpt-6-astra",
      reportedModel: "openai/gpt-5",
      response: { modelId: "openai/gpt-6-astra" },
    });
  });

  it("records no reported model when the gateway body reports none", async () => {
    fakeGateway({});
    const result = await generate();
    expect(result.trace).toMatchObject({ model: "openai/gpt-6-astra", reportedModel: null });
  });
});
