import { expect, it, vi } from "vitest";
import { readBoundedOriginalStream } from "../readBoundedOriginalStream";
it("enforces a smaller actual byte cap", async () => {
  const cancel = vi.fn(),
    stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(5));
      },
      cancel,
    });
  await expect(readBoundedOriginalStream(stream, { maxBytes: 4 })).rejects.toThrow("limit");
  expect(cancel).toHaveBeenCalledOnce();
});
it("deadline releases a stalled reader even if cancellation never resolves", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn(() => new Promise<void>(() => {})),
    stream = new ReadableStream<Uint8Array>({ cancel });
  const result = expect(readBoundedOriginalStream(stream, { timeoutMs: 30 })).rejects.toThrow(
    "deadline",
  );
  await vi.advanceTimersByTimeAsync(31);
  await result;
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
  vi.useRealTimers();
});
it("disconnect cancels and releases its reader", async () => {
  const c = new AbortController(),
    cancel = vi.fn(),
    stream = new ReadableStream<Uint8Array>({ cancel });
  const result = expect(readBoundedOriginalStream(stream, { signal: c.signal })).rejects.toThrow(
    "disconnected",
  );
  c.abort();
  await result;
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
});

it("an already disconnected request never retains bytes", async () => {
  const c = new AbortController();
  c.abort();
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(r) {
      r.enqueue(new Uint8Array([1]));
    },
    cancel,
  });
  await expect(readBoundedOriginalStream(stream, { signal: c.signal })).rejects.toThrow(
    "disconnected",
  );
  expect(cancel).toHaveBeenCalledOnce();
});
