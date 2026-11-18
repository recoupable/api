import { beforeEach, expect, it, vi } from "vitest";
import { createGateway } from "@ai-sdk/gateway";
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { runAgentStep } from "../runAgentStep";
const state = vi.hoisted(() => ({
  model: undefined as unknown,
  controller: undefined as AbortController | undefined,
}));
vi.mock("@ai-sdk/gateway", async importOriginal => ({
  ...(await importOriginal<typeof import("@ai-sdk/gateway")>()),
  gateway: () => state.model,
}));
vi.mock("@/lib/agent/buildAgentTools", () => ({ buildAgentTools: () => ({}) }));
vi.mock("workflow", async original => ({
  ...(await original<typeof import("workflow")>()),
  getWorkflowMetadata: () => ({ workflowRunId: "run" }),
  getStepMetadata: () => ({ stepId: "step", attempt: 1 }),
}));
vi.mock("@/lib/chat/pollWorkflowCancellation", () => ({
  pollWorkflowCancellation: (_id: string, controller: AbortController) => {
    state.controller = controller;
    return { stop() {}, done: Promise.resolve() };
  },
}));
vi.mock("@/lib/chat/isRunCancelled", () => ({ isRunCancelled: async () => false }));
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("External fetch forbidden");
    }),
  );
});
const seed: UIMessage = {
  id: "assistant",
  role: "assistant",
  parts: [{ type: "text", text: "prior", state: "done" }],
};
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
async function produce(
  failWrite: boolean | "first" | "stop-after-observation" = false,
  previous = seed,
) {
  const events = [
    { type: "stream-start", warnings: [] },
    {
      type: "custom",
      kind: "provider.synthetic",
      providerMetadata: { provider: { opaque: "kept" } },
    },
    { type: "reasoning-file", mediaType: "image/png", data: { type: "data", data: "AA==" } },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      providerMetadata: { gateway: { cost: "0.001" } },
    },
  ];
  let calls = 0;
  const gateway = createGateway({
    apiKey: "synthetic-not-a-credential",
    baseURL: "https://synthetic.invalid/v4/ai",
    fetch: async () => {
      calls++;
      return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(""), {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  state.model = gateway("synthetic/model");
  const chunks: UIMessageChunk[] = [];
  const result = await runAgentStep({
    modelMessages: [{ role: "user", content: "synthetic" }],
    originalMessages: [previous],
    modelId: "synthetic/model",
    assistantMessageId: "assistant",
    agentContext: {
      sandbox: { state: { type: "vercel" }, workingDirectory: "/synthetic" },
    } as never,
    writable: new WritableStream({
      write(chunk) {
        if (
          failWrite === "first" ||
          (failWrite === true && chunk.type === "data-recoup-sdk-observation")
        )
          throw new Error("ambiguous write");
        chunks.push(chunk);
        if (failWrite === "stop-after-observation" && chunk.type === "data-recoup-sdk-observation")
          state.controller?.abort();
      },
    }),
  });
  expect(calls).toBe(1);
  expect(fetch).not.toHaveBeenCalled();
  return { result, chunks };
}
it("projects actual Gateway emissions while retaining native model history", async () => {
  const { result, chunks } = await produce();
  expect(result.compatibilityFailure).toBeUndefined();
  expect(result.generatedProjectionObservations?.observations).toHaveLength(2);
  expect(chunks.some(chunk => chunk.type === "custom" || chunk.type === "reasoning-file")).toBe(
    false,
  );
  expect(result.nativeResponseMessage?.parts.some(part => part.type === "custom")).toBe(true);
  expect(
    result.responseMessages.some(message => JSON.stringify(message).includes("provider.synthetic")),
  ).toBe(true);
  expect(result.responseMessage?.parts[0]).toEqual(seed.parts[0]);
  expect(
    result.responseMessage?.parts.some(
      part => part.type === "custom" || part.type === "reasoning-file",
    ),
  ).toBe(false);
  let assembled;
  for await (const message of readUIMessageStream({
    message: structuredClone(seed),
    stream: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    terminateOnError: true,
  }))
    assembled = message;
  expect(assembled).toEqual(result.responseMessage);
  if (process.env.CHAT_PROJECTION_FIXTURE_OUTPUT)
    writeFileSync(
      process.env.CHAT_PROJECTION_FIXTURE_OUTPUT,
      JSON.stringify(
        {
          seed,
          chunks,
          result,
          scope:
            "Actual runAgentStep with actual Gateway/SDK and synthetic fetch; no real provider or production World. App transport qualification remains separate.",
        },
        null,
        2,
      ),
    );
});
it("does not promote failed canonical writes into Stop or retry the provider", async () => {
  const { result } = await produce(true);
  expect(result.aborted).toBe(false);
  expect(result.finishReason).toBe("error");
  expect(result.compatibilityFailure).toMatchObject({
    code: "evidence_unavailable",
    usageComplete: false,
  });
  expect(result.responseMessage).toBeUndefined();
});
it("collects only new emissions in the next iteration", async () => {
  const first = await produce();
  const second = await produce(false, first.result.responseMessage!);
  expect(second.result.generatedProjectionObservations?.observations).toHaveLength(2);
  expect(
    second.result.generatedProjectionObservations?.observations.map(
      item => item.observation.data.ordinal,
    ),
  ).toEqual([2, 3]);
});
it.skipIf(!process.env.CHAT_PROJECTION_LEGACY_SDK_ROOT)(
  "actual old SDK reads canonical wire split at every event boundary",
  async () => {
    const legacyRequire = createRequire(
      `${process.env.CHAT_PROJECTION_LEGACY_SDK_ROOT}/package.json`,
    );
    expect(legacyRequire("ai/package.json").version).toBe("6.0.241");
    const legacy = legacyRequire("ai") as typeof import("ai");
    const { result, chunks } = await produce();
    for (let cut = 0; cut <= chunks.length; cut++) {
      const encode = (events: UIMessageChunk[]) =>
        new TextEncoder().encode(
          events.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join(""),
        );
      const prefix = encode(chunks.slice(0, cut));
      const tail = new TextEncoder().encode(
        new TextDecoder().decode(encode(chunks.slice(cut))) + "data: [DONE]\n\n",
      );
      const accepted: UIMessageChunk[] = [];
      const parsedReader = legacy
        .parseJsonEventStream({
          stream: new ReadableStream({
            start(c) {
              c.enqueue(prefix);
              c.enqueue(tail);
              c.close();
            },
          }),
          schema: legacy.uiMessageChunkSchema,
        })
        .getReader();
      while (true) {
        const next = await parsedReader.read();
        if (next.done) break;
        const parsed = next.value;
        expect(parsed.success).toBe(true);
        if (parsed.success) accepted.push(parsed.value);
      }
      let assembled;
      for await (const message of legacy.readUIMessageStream({
        message: structuredClone(seed),
        stream: new ReadableStream({
          start(c) {
            for (const chunk of accepted) c.enqueue(chunk);
            c.close();
          },
        }),
        terminateOnError: true,
      }))
        assembled = message;
      expect(assembled).toEqual(result.responseMessage);
    }
  },
);

it("does not retry a provider after an unknown initial canonical append", async () => {
  const { result } = await produce("first");
  expect(result.compatibilityFailure).toMatchObject({
    code: "evidence_unavailable",
    usageComplete: false,
  });
  expect(result.finishReason).toBe("error");
  expect(result.aborted).toBe(false);
});

it("actual SDK cancellation after projection returns canonical Stop with fresh proof", async () => {
  const first = await produce();
  const { result } = await produce("stop-after-observation", first.result.responseMessage!);
  expect(result.aborted).toBe(true);
  expect(result.compatibilityFailure).toBeUndefined();
  expect(
    result.responseMessage?.parts.some(
      part => part.type === "custom" || part.type === "reasoning-file",
    ),
  ).toBe(false);
  expect(result.generatedProjectionObservations?.observations.length).toBeGreaterThan(0);
});
