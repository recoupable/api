import { expect, it, vi } from "vitest";
import { getChatWorkflowReadable } from "@/lib/chat/getChatWorkflowReadable";

it("propagates a failed SDK completion while a visible read is still pending and releases it", async () => {
  let fail!: (error: unknown) => void;
  const cancel = vi.fn();
  const source = Object.assign(new ReadableStream({ cancel }), { getTailIndex: async () => 11 });
  const getReadable = vi.fn(({ ops }) => {
    ops.push(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    return source;
  });
  const reader = getChatWorkflowReadable({ getReadable } as never).getReader();
  const pending = reader.read();
  const rejected = expect(pending).rejects.toThrow("synthetic completion failure");
  const error = new Error("synthetic completion failure");
  fail(error);
  await rejected;
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(cancel).toHaveBeenCalledExactlyOnceWith(error);
  expect(source.locked).toBe(false);
});

it("owns only its exact forwarded cancellation reason and preserves the tail helper", async () => {
  let fail!: (error: unknown) => void;
  const cancel = vi.fn((reason: unknown) => {
    fail(reason);
  });
  const source = Object.assign(new ReadableStream({ cancel }), { getTailIndex: async () => 11 });
  const getReadable = vi.fn(({ ops }) => {
    ops.push(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    return source;
  });
  const readable = getChatWorkflowReadable({ getReadable } as never, { startIndex: 8 });
  expect(await readable.getTailIndex()).toBe(11);
  expect(getReadable).toHaveBeenCalledWith({ startIndex: 8, ops: expect.any(Array) });
  await readable.cancel();
  expect(cancel).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
  expect(source.locked).toBe(false);
});

it("does not hide an unrelated completion failure during cancellation", async () => {
  let fail!: (error: unknown) => void;
  const unexpected = new Error("synthetic unrelated failure");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const source = Object.assign(
      new ReadableStream({
        cancel() {
          fail(unexpected);
        },
      }),
      {
        getTailIndex: async () => 0,
      },
    );
    const getReadable = vi.fn(({ ops }) => {
      ops.push(
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
      );
      return source;
    });
    await expect(getChatWorkflowReadable({ getReadable } as never).cancel()).rejects.toBe(
      unexpected,
    );
    expect(log).toHaveBeenCalledExactlyOnceWith(
      "[getChatWorkflowReadable] unexpected cancellation failure:",
      unexpected,
    );
    expect(source.locked).toBe(false);
  } finally {
    log.mockRestore();
  }
});
