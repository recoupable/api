import { expect, it, vi } from "vitest";
import { readUIMessageStream, type UIMessageChunk } from "ai";
import { persistFencedMessageStep } from "../persistFencedMessageStep";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
const writer = {
  chatId: "chat",
  effectiveAccount: "11111111-1111-4111-8111-111111111111",
  epoch: 1,
  owner: "22222222-2222-4222-8222-222222222222",
  runId: "original",
};
it("persists the installed SDK's actual message without absent optional object fields", async () => {
  const stream = new ReadableStream<UIMessageChunk>({
    start(c) {
      c.enqueue({ type: "start", messageId: "assistant" });
      c.enqueue({ type: "text-start", id: "text" });
      c.enqueue({ type: "text-delta", id: "text", delta: "hello" });
      c.enqueue({ type: "text-end", id: "text" });
      c.enqueue({ type: "finish" });
      c.close();
    },
  });
  let message;
  for await (const value of readUIMessageStream({ stream })) message = value;
  expect(Object.hasOwn(message!.parts[0], "providerMetadata")).toBe(true);
  rpc.mockResolvedValue({ data: { written: true, outcome: "inserted" }, error: null });
  await persistFencedMessageStep(writer, "assistant", {
    ...message!,
    metadata: { optional: undefined, trace: { values: [0, false, null, "é"] } },
  });
  expect(rpc.mock.calls.at(-1)![1].p.parts).toEqual({
    id: "assistant",
    role: "assistant",
    parts: [{ type: "text", text: "hello", state: "done" }],
    metadata: { trace: { values: [0, false, null, "é"] } },
  });
});

it.each([NaN, BigInt(1), () => true, new Date(), [undefined]])(
  "still rejects malformed meaningful data %s",
  async value => {
    rpc.mockClear();
    await expect(
      persistFencedMessageStep(writer, "assistant", {
        id: "assistant",
        role: "assistant",
        parts: [],
        metadata: { value },
      }),
    ).rejects.toThrow(/reconciliation/);
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("does not invoke getters or discard own invalid keys", async () => {
  const getter = vi.fn(() => undefined);
  const metadata = {};
  Object.defineProperty(metadata, "optional", { enumerable: true, get: getter });
  rpc.mockClear();
  await expect(
    persistFencedMessageStep(writer, "assistant", {
      id: "assistant",
      role: "assistant",
      parts: [],
      metadata,
    }),
  ).rejects.toThrow(/reconciliation/);
  expect(getter).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
