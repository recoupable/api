/** Copy at most 50MiB/10,000 chunks; no network timeout or storage operation. */
export async function readBoundedOriginalStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0;
  let count = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      if (!(next.value instanceof Uint8Array)) throw new Error("Original must contain byte chunks");
      bytes += next.value.byteLength;
      if (++count > 10_000 || bytes > 50 * 1024 * 1024)
        throw new Error("Original exceeds preparation limit");
      chunks.push(new Uint8Array(next.value));
    }
    if (!bytes) throw new Error("Original is empty");
    return new Blob(chunks);
  } catch (cause) {
    // Preserve the read/limit error even if transport cancellation also fails.
    await reader.cancel().catch(() => undefined);
    throw cause;
  } finally {
    reader.releaseLock();
  }
}
