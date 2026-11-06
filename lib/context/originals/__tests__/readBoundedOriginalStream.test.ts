import { expect, it, vi } from "vitest";
import { readBoundedOriginalStream } from "../readBoundedOriginalStream";
it("copies chunks and releases the reader", async () => {
  const bytes = new Uint8Array([65, 66]);
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
  const blob = await readBoundedOriginalStream(stream);
  bytes[0] = 90;
  expect(await blob.text()).toBe("AB");
  expect(stream.locked).toBe(false);
});
it("cancels once on byte overflow before retaining oversized data", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(50 * 1024 * 1024 + 1));
    },
    cancel,
  });
  await expect(readBoundedOriginalStream(stream)).rejects.toThrow("limit");
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(stream.locked).toBe(false);
});
it("rejects empty content", async () => {
  await expect(
    readBoundedOriginalStream(
      new ReadableStream({
        start(c) {
          c.close();
        },
      }),
    ),
  ).rejects.toThrow();
});
it("rejects non-byte chunks", async () => {
  await expect(
    readBoundedOriginalStream(
      new ReadableStream({
        start(c) {
          c.enqueue("invalid");
          c.close();
        },
      }) as never,
    ),
  ).rejects.toThrow();
});
it("limits excessive chunk count, including empty chunks", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      c.enqueue(new Uint8Array());
    },
    cancel,
  });
  await expect(readBoundedOriginalStream(stream)).rejects.toThrow("limit");
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(stream.locked).toBe(false);
});
