import { raceToolExecution } from "./raceToolExecution";
import { wrapToolAsyncIterable } from "./wrapToolAsyncIterable";
import type { ToolSet } from "ai";

export class ToolAbortedError extends Error {
  readonly name = "ToolAbortedError" as const;
  constructor(toolName: string) {
    super(`Tool "${toolName}" aborted by user stop signal`);
  }
}

/**
 * Preserves synchronous async-iterable results and races each operation against `signal`.
 * On abort, even tools
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
    const originalExecute = execute.bind(tool) as (input: unknown, options: unknown) => unknown;
    wrapped[name] = {
      ...tool,
      execute: (input: unknown, options: unknown) => {
        const createAbortError = () => new ToolAbortedError(name);
        if (signal.aborted) return Promise.reject(createAbortError());
        try {
          const result = originalExecute(input, options);
          if (
            result !== null &&
            typeof result === "object" &&
            Symbol.asyncIterator in result &&
            typeof result[Symbol.asyncIterator] === "function"
          ) {
            return wrapToolAsyncIterable(
              result as AsyncIterable<unknown>,
              signal,
              createAbortError,
            );
          }
          return raceToolExecution(result, signal, createAbortError);
        } catch (error) {
          return Promise.reject(error);
        }
      },
    } as T[keyof T];
  }
  return wrapped as unknown as T;
}
