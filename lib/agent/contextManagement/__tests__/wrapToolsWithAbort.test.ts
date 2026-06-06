import { describe, it, expect, vi } from "vitest";
import { tool } from "ai";
import { z } from "zod";
import { wrapToolsWithAbort, ToolAbortedError } from "../wrapToolsWithAbort";

function makeTool(execute?: (input: { x: number }) => Promise<unknown>) {
  return tool({
    description: "test tool",
    inputSchema: z.object({ x: z.number() }),
    execute,
  });
}

describe("wrapToolsWithAbort", () => {
  it("passes through tools that have no execute", () => {
    const t = tool({
      description: "client-fulfilled",
      inputSchema: z.object({ x: z.number() }),
    });
    const wrapped = wrapToolsWithAbort({ ask: t }, new AbortController().signal);
    expect(wrapped.ask).toBe(t);
  });

  it("returns the tool's result when it resolves before abort", async () => {
    const t = makeTool(async ({ x }) => ({ doubled: x * 2 }));
    const ctrl = new AbortController();
    const wrapped = wrapToolsWithAbort({ double: t }, ctrl.signal);

    const result = await wrapped.double.execute!({ x: 7 }, {} as never);

    expect(result).toEqual({ doubled: 14 });
  });

  it("rejects with ToolAbortedError when signal fires mid-execution", async () => {
    // Tool that never resolves on its own — simulates a hung tool that
    // ignores its own abortSignal.
    const t = makeTool(() => new Promise(() => {}));
    const ctrl = new AbortController();
    const wrapped = wrapToolsWithAbort({ hang: t }, ctrl.signal);

    const promise = wrapped.hang.execute!({ x: 1 }, {} as never);
    setTimeout(() => ctrl.abort(), 5);

    await expect(promise).rejects.toBeInstanceOf(ToolAbortedError);
  });

  it("rejects immediately if signal is already aborted at entry", async () => {
    const t = makeTool(async () => ({ result: "wat" }));
    const ctrl = new AbortController();
    ctrl.abort();
    const wrapped = wrapToolsWithAbort({ t }, ctrl.signal);

    await expect(wrapped.t.execute!({ x: 1 }, {} as never)).rejects.toBeInstanceOf(
      ToolAbortedError,
    );
  });

  it("propagates the tool's own errors when it rejects before abort", async () => {
    const boom = new Error("tool blew up");
    const t = makeTool(async () => {
      throw boom;
    });
    const ctrl = new AbortController();
    const wrapped = wrapToolsWithAbort({ t }, ctrl.signal);

    await expect(wrapped.t.execute!({ x: 1 }, {} as never)).rejects.toBe(boom);
  });

  it("removes the abort listener once the tool settles", async () => {
    const ctrl = new AbortController();
    const addSpy = vi.spyOn(ctrl.signal, "addEventListener");
    const removeSpy = vi.spyOn(ctrl.signal, "removeEventListener");
    const t = makeTool(async () => ({ ok: true }));
    const wrapped = wrapToolsWithAbort({ t }, ctrl.signal);

    await wrapped.t.execute!({ x: 1 }, {} as never);

    expect(addSpy).toHaveBeenCalledWith("abort", expect.any(Function), {
      once: true,
    });
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("preserves non-execute fields on each tool", () => {
    const t = makeTool(async () => ({}));
    const wrapped = wrapToolsWithAbort({ t }, new AbortController().signal);

    expect(wrapped.t.description).toBe(t.description);
    expect(wrapped.t.inputSchema).toBe(t.inputSchema);
  });

  it("forwards input and options (including AI SDK's abortSignal) unchanged to the original execute", async () => {
    const seen: Array<{ input: unknown; options: unknown }> = [];
    const t = makeTool(async (input: unknown, options: unknown) => {
      seen.push({ input, options });
      return { ok: true };
    });
    const wrapped = wrapToolsWithAbort({ t }, new AbortController().signal);

    const innerSignal = new AbortController().signal;
    await wrapped.t.execute!({ x: 42 }, { abortSignal: innerSignal } as never);

    expect(seen).toHaveLength(1);
    expect(seen[0].input).toEqual({ x: 42 });
    expect((seen[0].options as { abortSignal: AbortSignal }).abortSignal).toBe(innerSignal);
  });
});
