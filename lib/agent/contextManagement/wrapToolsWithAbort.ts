import type { ToolSet } from "ai";

/** Marker error thrown when a tool is forcibly unblocked by the cancel signal. */
export class ToolAbortedError extends Error {
  readonly name = "ToolAbortedError" as const;
  constructor(toolName: string) {
    super(`Tool "${toolName}" aborted by user stop signal`);
  }
}

/**
 * Universal tool-kill wrapper for AI SDK tools.
 *
 * The AI SDK already passes `abortSignal` into `tool.execute(input, { abortSignal })`,
 * but a tool implementation that ignores it (or wraps `fetch` without `{ signal }`)
 * will keep running until it returns naturally. `streamText` awaits the tool's
 * promise, so a hung tool hangs the entire agent loop after stop — the
 * workflow body never returns, its writable never closes, and the SSE never
 * ends. The chat UI is stuck in "streaming".
 *
 * This wrapper races every tool's `execute` promise against the signal's
 * `abort` event. When the user cancels, even a non-cooperating tool's
 * promise rejects with {@link ToolAbortedError}, `streamText` moves on, and
 * the workflow returns cleanly. The original tool's work may continue
 * running in the background (we can't kill JS), but the agent loop is
 * unblocked and the SSE closes immediately.
 *
 * Tools without an `execute` (e.g. client-fulfilled ones like ask_user_question)
 * pass through untouched.
 */
export function wrapToolsWithAbort<T extends ToolSet>(tools: T, signal: AbortSignal): T {
  const wrapped: Record<string, T[keyof T]> = {};
  for (const [name, tool] of Object.entries(tools) as Array<[string, T[keyof T]]>) {
    const execute = (tool as { execute?: unknown }).execute;
    if (typeof execute !== "function") {
      wrapped[name] = tool;
      continue;
    }
    const originalExecute = execute.bind(tool) as (
      input: unknown,
      options: unknown,
    ) => Promise<unknown>;
    wrapped[name] = {
      ...tool,
      execute: async (input: unknown, options: unknown) => {
        if (signal.aborted) throw new ToolAbortedError(name);
        let onAbort: (() => void) | undefined;
        const abortPromise = new Promise<never>((_, reject) => {
          onAbort = () => reject(new ToolAbortedError(name));
          signal.addEventListener("abort", onAbort, { once: true });
        });
        try {
          return await Promise.race([originalExecute(input, options), abortPromise]);
        } finally {
          if (onAbort) signal.removeEventListener("abort", onAbort);
        }
      },
    } as T[keyof T];
  }
  return wrapped as unknown as T;
}
