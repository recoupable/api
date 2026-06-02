import type { ToolSet } from "ai";

export class ToolAbortedError extends Error {
  readonly name = "ToolAbortedError" as const;
  constructor(toolName: string) {
    super(`Tool "${toolName}" aborted by user stop signal`);
  }
}

/**
 * Races every tool's `execute` promise against `signal`. On abort, even tools
 * that ignore their own abortSignal reject with {@link ToolAbortedError} so
 * `streamText` can move on instead of hanging the agent loop.
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
