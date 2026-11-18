/** Race one promise or iterator operation, observing late rejection and releasing its listener. */
export async function raceToolExecution<T>(
  result: T | PromiseLike<T>,
  signal: AbortSignal,
  createAbortError: () => Error,
): Promise<T> {
  if (signal.aborted) {
    void Promise.resolve(result).catch(() => {});
    throw createAbortError();
  }
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(createAbortError());
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([result, aborted]);
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}
