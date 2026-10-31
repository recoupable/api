import { beforeEach, expect, expectTypeOf, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { createFencedMessageWriter } from "../createFencedMessageWriter";
import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
const captured = {
  chatId: "chat",
  effectiveAccount: "11111111-1111-4111-8111-111111111111",
  epoch: 1,
  owner: "22222222-2222-4222-8222-222222222222",
  runId: "original-run",
};
const message = {
  id: "user-1",
  role: "user",
  parts: [
    { type: "text", text: "hello" },
    { type: "data-evidence", data: { nested: [1, "é"] } },
  ],
  metadata: { trace: { id: "trace" } },
} as UIMessage;
beforeEach(() => vi.clearAllMocks());
it.each(["inserted", "exactDuplicate"])(
  "preserves full user UIMessage and explicit %s outcome",
  async outcome => {
    rpc.mockResolvedValue({
      data: { written: true, outcome },
      error: null,
    } as never);
    const writer = createFencedMessageWriter(captured, executeChatFenceCommand);
    expect(await writer.insertUser(message)).toEqual({ written: true, outcome });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("chat_fence_command", {
      p_chat: "chat",
      p_account: captured.effectiveAccount,
      p_action: "write",
      p: {
        owner: captured.owner,
        epoch: 1,
        run_id: captured.runId,
        id: message.id,
        role: "user",
        mode: "insert",
        parts: message,
      },
    });
  },
);
it.each(["inserted", "exactDuplicate", "updated"])(
  "assistant uses generation-checked upsert for %s",
  async outcome => {
    rpc.mockResolvedValue({
      data: { written: true, outcome },
      error: null,
    } as never);
    const assistant = { ...message, id: "assistant-1", role: "assistant" } as UIMessage;
    expect(
      await createFencedMessageWriter(captured, executeChatFenceCommand).upsertAssistant(assistant),
    ).toEqual({ written: true, outcome });
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_action: "write",
      p: { mode: "upsert", parts: assistant },
    });
  },
);
it("captures authority/run once and never reads a current epoch", async () => {
  const mutable = { ...captured };
  const writer = createFencedMessageWriter(mutable, executeChatFenceCommand);
  mutable.epoch = 50;
  mutable.owner = "33333333-3333-4333-8333-333333333333";
  mutable.runId = "new-run";
  rpc.mockResolvedValue({
    data: { written: true, outcome: "inserted" },
    error: null,
  } as never);
  await writer.insertUser(message);
  expect(rpc.mock.calls[0][1]).toMatchObject({
    p_action: "write",
    p: { epoch: 1, owner: captured.owner, run_id: "original-run" },
  });
  expect(Object.isFrozen(writer)).toBe(true);
});
it.each(["40001", "42501", "22023", "40P01"])(
  "throws required SQL failure %s without retry or ancillary calls",
  async code => {
    rpc.mockResolvedValue({
      data: null,
      error: { code, message: "do not expose" },
    } as never);
    await expect(
      createFencedMessageWriter(captured, executeChatFenceCommand).insertUser(message),
    ).rejects.toThrow("Required fenced persistence failed");
    expect(rpc).toHaveBeenCalledTimes(1);
  },
);
it("preserves transport ambiguity and never auto-retries", async () => {
  rpc.mockRejectedValue(new Error("lost response"));
  await expect(
    createFencedMessageWriter(captured, executeChatFenceCommand).insertUser(message),
  ).rejects.toMatchObject({ kind: "transport_ambiguous" });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("update_parts missing row is a required failure, not success", async () => {
  rpc.mockResolvedValue({ data: { updated: false }, error: null } as never);
  await expect(
    createFencedMessageWriter(captured, executeChatFenceCommand).updateAssistantParts({
      ...message,
      role: "assistant",
    } as UIMessage),
  ).rejects.toMatchObject({ kind: "missing_message" });
});
it("retains whole updated assistant data and metadata", async () => {
  rpc.mockResolvedValue({ data: { updated: true }, error: null } as never);
  const assistant = { ...message, role: "assistant" } as UIMessage;
  expect(
    await createFencedMessageWriter(captured, executeChatFenceCommand).updateAssistantParts(
      assistant,
    ),
  ).toEqual({ updated: true });
  expect(rpc.mock.calls[0][1]).toMatchObject({
    p_action: "update_parts",
    p: { parts: assistant },
  });
});
it("rejects role changes and malformed JSON before RPC", async () => {
  const writer = createFencedMessageWriter(captured, executeChatFenceCommand);
  await expect(writer.upsertAssistant(message)).rejects.toMatchObject({ kind: "invalid_command" });
  await expect(
    writer.insertUser({ ...message, metadata: { bad: undefined } }),
  ).rejects.toMatchObject({ kind: "invalid_command" });
  expect(rpc).not.toHaveBeenCalled();
});

it("rejects accessors without evaluating them", async () => {
  const getter = vi.fn(() => "user-1");
  const malformed = { ...message };
  Object.defineProperty(malformed, "id", { enumerable: true, get: getter });
  await expect(
    createFencedMessageWriter(captured, executeChatFenceCommand).insertUser(malformed),
  ).rejects.toMatchObject({ kind: "invalid_command" });
  expect(getter).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it("does not allow a malformed success receipt to pass", async () => {
  rpc.mockResolvedValue({ data: { written: true, outcome: "updated" }, error: null } as never);
  await expect(
    createFencedMessageWriter(captured, executeChatFenceCommand).insertUser(message),
  ).rejects.toMatchObject({ kind: "invalid_receipt" });
});

it("exposes operation-specific receipt types", () => {
  const writer = createFencedMessageWriter(captured, executeChatFenceCommand);
  expectTypeOf(writer.insertUser).returns.resolves.toEqualTypeOf<{
    written: true;
    outcome: "inserted" | "exactDuplicate";
  }>();
  expectTypeOf(writer.upsertAssistant).returns.resolves.toEqualTypeOf<{
    written: true;
    outcome: "inserted" | "exactDuplicate" | "updated";
  }>();
  expectTypeOf(writer.updateAssistantParts).returns.resolves.toEqualTypeOf<{ updated: true }>();
});
