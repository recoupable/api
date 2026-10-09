/** Bounded copying; optional transport deadline/disconnect stops consumption, not downstream writes. */
export async function readBoundedOriginalStream(
  stream: ReadableStream<Uint8Array>,
  options: { maxBytes?: number; timeoutMs?: number; signal?: AbortSignal } = {},
) {
  const reader = stream.getReader(),
    chunks: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0,
    count = 0,
    timer: ReturnType<typeof setTimeout> | undefined;
  let rejectStop: (error: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    rejectStop = reject;
  });
  const abort = () => rejectStop(new Error("Original request disconnected"));
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  if (options.timeoutMs)
    timer = setTimeout(
      () => rejectStop(new Error("Original read deadline exceeded")),
      options.timeoutMs,
    );
  try {
    while (true) {
      const next = await Promise.race([reader.read(), stopped]);
      if (next.done) break;
      if (!(next.value instanceof Uint8Array)) throw new Error("Original must contain byte chunks");
      bytes += next.value.byteLength;
      if (++count > 10000 || bytes > (options.maxBytes ?? 50 * 1024 * 1024))
        throw new Error("Original exceeds preparation limit");
      chunks.push(new Uint8Array(next.value));
    }
    if (!bytes) throw new Error("Original is empty");
    return new Blob(chunks);
  } catch (cause) {
    // A broken upstream cancel must not hold the deadline or reader lock forever.
    void reader.cancel().catch(() => undefined);
    throw cause;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
