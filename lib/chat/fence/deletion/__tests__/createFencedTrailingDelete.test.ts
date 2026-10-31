import { beforeEach, expect, it, vi } from "vitest";
import { createFencedTrailingDelete } from "../createFencedTrailingDelete";
import { executeChatFenceCommand } from "@/lib/supabase/chat_fence/executeChatFenceCommand";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
const original = {
  chatId: "chat",
  effectiveAccount: "11111111-1111-4111-8111-111111111111",
  expectedEpoch: 4,
  requestId: "22222222-2222-4222-8222-222222222222",
  anchorId: "anchor",
};
const receipt = { request_id: original.requestId, epoch: 5, deleted: 3 };
beforeEach(() => rpc.mockReset());
it("submits exactly one delete with captured original identity and requires its receipt", async () => {
  const input = { ...original };
  const adapter = createFencedTrailingDelete(input, executeChatFenceCommand);
  input.expectedEpoch = 99;
  input.anchorId = "replacement";
  input.chatId = "other";
  rpc.mockResolvedValue({ data: receipt, error: null });
  await expect(adapter.delete()).resolves.toEqual(receipt);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("chat_fence_command", {
    p_chat: "chat",
    p_account: original.effectiveAccount,
    p_action: "delete",
    p: { request_id: original.requestId, expected_epoch: 4, anchor_id: "anchor" },
  });
});
it("keeps the exact original command after an ambiguous committed response, with no automatic retry", async () => {
  const adapter = createFencedTrailingDelete(original, executeChatFenceCommand);
  rpc.mockRejectedValueOnce(new Error("sensitive transport details"));
  await expect(adapter.delete()).rejects.toMatchObject({
    kind: "transport_ambiguous",
    retrySameCommand: false,
  });
  expect(rpc).toHaveBeenCalledTimes(1);
  rpc.mockResolvedValue({ data: receipt, error: null });
  await expect(adapter.delete()).resolves.toEqual(receipt);
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
});
it.each(["40001", "42501", "P0002", "55000", "22023", "40P01"])(
  "propagates SQL %s without state lookup or fallback",
  async code => {
    rpc.mockResolvedValue({ data: null, error: { code } });
    await expect(
      createFencedTrailingDelete(original, executeChatFenceCommand).delete(),
    ).rejects.toMatchObject({ retrySameCommand: code === "40P01" });
    expect(rpc).toHaveBeenCalledTimes(1);
  },
);
it.each([
  null,
  true,
  {},
  { ...receipt, request_id: "33333333-3333-4333-8333-333333333333" },
  { ...receipt, epoch: 6 },
  { ...receipt, deleted: -1 },
  { ...receipt, chat_id: "invented-proof" },
])("rejects invalid acknowledgement %j", async data => {
  rpc.mockResolvedValue({ data, error: null });
  await expect(
    createFencedTrailingDelete(original, executeChatFenceCommand).delete(),
  ).rejects.toMatchObject({ kind: "invalid_receipt" });
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("validates acknowledgement even when an injected typed executor lies", async () => {
  const execute = vi
    .fn()
    .mockResolvedValue({ ok: true, action: "delete", value: { ...receipt, epoch: 90 } });
  await expect(createFencedTrailingDelete(original, execute).delete()).rejects.toMatchObject({
    kind: "invalid_receipt",
  });
});
it("sanitizes thrown failures and rejects wrong action or missing results", async () => {
  for (const value of [undefined, { ok: true, action: "state", value: receipt }]) {
    await expect(
      createFencedTrailingDelete(original, vi.fn().mockResolvedValue(value)).delete(),
    ).rejects.toMatchObject({ kind: "invalid_receipt" });
  }
  await expect(
    createFencedTrailingDelete(original, vi.fn().mockRejectedValue(new Error("secret"))).delete(),
  ).rejects.toMatchObject({ kind: "transport_ambiguous" });
});
it.each([
  { expectedEpoch: -1 },
  { requestId: "invalid" },
  { effectiveAccount: "invalid" },
  { anchorId: "" },
  { expectedEpoch: Number.MAX_SAFE_INTEGER },
])("rejects malformed original identity before any RPC %j", fields => {
  expect(() =>
    createFencedTrailingDelete({ ...original, ...fields }, executeChatFenceCommand),
  ).toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
