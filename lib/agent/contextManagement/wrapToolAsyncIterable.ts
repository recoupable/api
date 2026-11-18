import { raceToolExecution } from "./raceToolExecution";

/** Preserve an observable iterable and forward iterator control while bounding abort latency. */
export function wrapToolAsyncIterable<T>(
  source: AsyncIterable<T>,
  signal: AbortSignal,
  createAbortError: () => Error,
): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]() {
      const iterator = source[Symbol.asyncIterator]();
      let ended = false;
      let abortCleanupRequested = false;
      let closing: Promise<IteratorResult<T>> | undefined;
      function close(value?: unknown): Promise<IteratorResult<T>> {
        if (closing) return closing;
        if (ended) return Promise.resolve({ done: true, value });
        closing = Promise.resolve()
          .then(() => (iterator.return ? iterator.return(value) : { done: true as const, value }))
          .then(step => {
            if (step.done) ended = true;
            return step;
          })
          .finally(() => {
            closing = undefined;
          });
        return closing;
      }
      function requestAbortCleanup() {
        if (abortCleanupRequested) return;
        abortCleanupRequested = true;
        void close().catch(() => {});
      }
      async function advance(
        method: "next" | "throw",
        value?: unknown,
      ): Promise<IteratorResult<T>> {
        if (ended) {
          if (method === "throw") throw value;
          return { done: true, value: undefined };
        }
        if (signal.aborted) {
          requestAbortCleanup();
          throw createAbortError();
        }
        try {
          const pending = method === "next" ? iterator.next(value) : iterator.throw!(value);
          const step = await raceToolExecution(pending, signal, createAbortError);
          if (step.done) ended = true;
          return step;
        } catch (error) {
          if (signal.aborted) {
            // return() may queue behind a non-cooperative next(). Request cleanup
            // once, observe its failure, but never make user-stop wait for it.
            requestAbortCleanup();
          } else ended = true;
          throw error;
        }
      }
      return {
        next: value => advance("next", value),
        return: value => raceToolExecution(close(value), signal, createAbortError),
        throw: async error => {
          if (iterator.throw) return advance("throw", error);
          await close();
          throw error;
        },
      };
    },
  };
}
