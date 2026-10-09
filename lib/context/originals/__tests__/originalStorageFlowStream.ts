export function originalStorageFlowStream(value = text) {
  return new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(value));
      c.close();
    },
  });
}
