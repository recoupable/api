import { describe, expect, it, vi } from "vitest";
import { generateText, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { wrapToolsWithAbort, ToolAbortedError } from "../wrapToolsWithAbort";

const options = { toolCallId: "fixture-call", messages: [], context: {} };
function generatorTool(execute: () => AsyncGenerator<string>) {
  return tool({ inputSchema: z.object({}), execute });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("abort wrapper with installed SDK async iterable execution", () => {
  it("executes a wrapped generator once through the real SDK and uses its final yield", async () => {
    let entered = 0;
    let cleaned = 0;
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: "tool-call", toolCallId: "fixture-call", toolName: "task", input: "{}" }],
        finishReason: { unified: "tool-calls", raw: undefined },
        warnings: [],
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
      },
    });
    const task = generatorTool(async function* () {
      entered++;
      try {
        yield "pending";
        yield "completed child result";
      } finally {
        cleaned++;
      }
    });
    const result = await generateText({
      model,
      prompt: "run task",
      tools: wrapToolsWithAbort({ task }, new AbortController().signal),
    });
    expect(entered).toBe(1);
    expect(cleaned).toBe(1);
    expect(result.toolResults[0].output).toBe("completed child result");
  });

  it("does not start an already aborted generator", async () => {
    const execute = vi.fn(async function* () {
      yield "unexpected";
    });
    const controller = new AbortController();
    controller.abort();
    const wrapped = wrapToolsWithAbort({ task: generatorTool(execute) }, controller.signal);
    await expect(wrapped.task.execute!({}, options)).rejects.toBeInstanceOf(ToolAbortedError);
    expect(execute).not.toHaveBeenCalled();
  });

  it("aborts pending iteration promptly and eventually closes a cooperative generator once", async () => {
    const gate = deferred<void>();
    let cleanup = 0;
    const task = generatorTool(async function* () {
      try {
        yield "pending";
        await gate.promise;
        yield "late";
      } finally {
        cleanup++;
      }
    });
    const controller = new AbortController();
    const wrapped = wrapToolsWithAbort({ task }, controller.signal);
    const result = wrapped.task.execute!({}, options);
    expect(Symbol.asyncIterator in Object(result)).toBe(true);
    const iterator = (result as AsyncIterable<string>)[Symbol.asyncIterator]();
    expect(await iterator.next()).toEqual({ value: "pending", done: false });
    const pending = iterator.next();
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(ToolAbortedError);
    gate.resolve();
    await vi.waitFor(() => expect(cleanup).toBe(1));
  });

  it("forwards consumer return and exposes cleanup failures", async () => {
    const failure = new Error("cleanup failure");
    let cleanup = 0;
    const wrapped = wrapToolsWithAbort(
      {
        task: generatorTool(async function* () {
          try {
            yield "pending";
          } finally {
            cleanup++;
            throw failure;
          }
        }),
      },
      new AbortController().signal,
    );
    const result = wrapped.task.execute!({}, options);
    expect(Symbol.asyncIterator in Object(result)).toBe(true);
    const iterator = (result as AsyncIterable<string>)[Symbol.asyncIterator]();
    await iterator.next();
    await expect(iterator.return!()).rejects.toBe(failure);
    expect(cleanup).toBe(1);
  });

  it("allows cleanup to yield before finishing a consumer return", async () => {
    let cleaned = false;
    const wrapped = wrapToolsWithAbort(
      {
        task: generatorTool(async function* () {
          try {
            yield "pending";
          } finally {
            yield "cleaning";
            cleaned = true;
          }
        }),
      },
      new AbortController().signal,
    );
    const iterator = (wrapped.task.execute!({}, options) as AsyncIterable<string>)[
      Symbol.asyncIterator
    ]();
    await iterator.next();
    expect(await iterator.return!()).toEqual({ done: false, value: "cleaning" });
    expect((await iterator.next()).done).toBe(true);
    expect(cleaned).toBe(true);
  });

  it("forwards consumer throw to the generator and preserves its final result", async () => {
    const failure = new Error("consumer failure");
    const received = vi.fn();
    const wrapped = wrapToolsWithAbort(
      {
        task: generatorTool(async function* () {
          try {
            yield "pending";
          } catch (error) {
            received(error);
            yield "recovered";
          }
        }),
      },
      new AbortController().signal,
    );
    const result = wrapped.task.execute!({}, options);
    expect(Symbol.asyncIterator in Object(result)).toBe(true);
    const iterator = (result as AsyncIterable<string>)[Symbol.asyncIterator]();
    await iterator.next();
    expect(await iterator.throw!(failure)).toEqual({ done: false, value: "recovered" });
    expect(received).toHaveBeenCalledWith(failure);
    expect((await iterator.next()).done).toBe(true);
  });
});
