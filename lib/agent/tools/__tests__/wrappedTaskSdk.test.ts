import { expect, it, vi } from "vitest";
import { generateText, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { taskTool } from "../taskTool";
import { buildToolsContext } from "../buildToolsContext";
import { wrapToolsWithAbort } from "../../contextManagement/wrapToolsWithAbort";

vi.mock("ai", async () => ({
  ...(await vi.importActual<typeof import("ai")>("ai")),
  streamText: vi.fn(),
}));

it("runs the actual wrapped task generator through the installed SDK instead of emitting a fallback", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: {
      content: [
        {
          type: "tool-call",
          toolCallId: "task-call",
          toolName: "task",
          input: '{"task":"inspect","instructions":"inspect fixture"}',
        },
      ],
      finishReason: { unified: "tool-calls", raw: undefined },
      warnings: [],
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
    },
  });
  let childStreamEntered = 0;
  vi.mocked(streamText).mockReturnValue({
    stream: (async function* () {
      childStreamEntered++;
      yield { type: "finish-step", usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } };
    })(),
    responseMessages: Promise.resolve([
      { role: "assistant", content: [{ type: "text", text: "actual child completed" }] },
    ]),
  } as never);
  const tools = wrapToolsWithAbort({ task: taskTool }, new AbortController().signal);
  const result = await generateText({
    model,
    prompt: "run child",
    tools,
    toolsContext: buildToolsContext(tools, {
      model,
      sandbox: { state: {}, workingDirectory: "." },
    }),
  });
  expect(streamText).toHaveBeenCalledOnce();
  expect(childStreamEntered).toBe(1);
  expect(result.toolResults[0].output).toMatchObject({
    final: [{ role: "assistant", content: [{ type: "text", text: "actual child completed" }] }],
    usage: { inputTokens: 2, outputTokens: 3 },
  });
  expect(JSON.stringify(result.responseMessages)).toContain("actual child completed");
  expect(JSON.stringify(result.responseMessages)).not.toContain("Task completed.");
});

it("aborts the actual child stream during iteration and runs cleanup once", async () => {
  vi.mocked(streamText).mockClear();
  const controller = new AbortController();
  let entered = 0;
  let cleaned = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const model = new MockLanguageModelV4({
    doGenerate: {
      content: [
        {
          type: "tool-call",
          toolCallId: "task-call",
          toolName: "task",
          input: '{"task":"inspect","instructions":"inspect fixture"}',
        },
      ],
      finishReason: { unified: "tool-calls", raw: undefined },
      warnings: [],
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
    },
  });
  vi.mocked(streamText).mockReturnValue({
    stream: (async function* () {
      entered++;
      try {
        await gate;
      } finally {
        cleaned++;
      }
    })(),
    responseMessages: Promise.resolve([]),
    totalUsage: Promise.resolve({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
  } as never);
  const tools = wrapToolsWithAbort({ task: taskTool }, controller.signal);
  const pending = generateText({
    model,
    prompt: "run child",
    tools,
    abortSignal: controller.signal,
    toolsContext: buildToolsContext(tools, {
      model,
      sandbox: { state: {}, workingDirectory: "." },
    }),
  });
  // Observe rejection before abort so this probe cannot introduce an unhandled rejection.
  const outcome = pending.then(
    value => ({ value }),
    error => ({ error }),
  );
  await vi.waitFor(() => expect(entered).toBe(1));
  controller.abort();
  const settled = await outcome;
  release();
  await vi.waitFor(() => expect(cleaned).toBe(1));
  if (!("value" in settled)) throw settled.error;
  expect(settled.value.toolResults).toEqual([]);
  expect(settled.value.steps[0].content).toContainEqual(
    expect.objectContaining({
      type: "tool-error",
      error: expect.objectContaining({ name: "ToolAbortedError" }),
    }),
  );
  expect(JSON.stringify(settled.value.responseMessages)).not.toContain("Task completed.");
  expect(streamText).toHaveBeenCalledOnce();
  expect(vi.mocked(streamText).mock.calls[0][0].abortSignal?.aborted).toBe(true);
});
