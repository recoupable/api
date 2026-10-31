import { expect, it, vi } from "vitest";
import { dispatchChatFenceOnce } from "../dispatchChatFenceOnce";
import { snapshotFixture, account, requestId } from "./snapshotFixture";
const authority = { chatId: "chat", effectiveAccount: account, owner: requestId, epoch: 1 };
const attemptId = "55555555-5555-4555-8555-555555555555";
it("concurrent attempts get one synthetic start; all replays remain information-only", async () => {
  const { receipt } = snapshotFixture();
  let consumed = false;
  const claim = vi.fn(async () => {
    const claimed = !consumed;
    consumed = true;
    return { claimed, attempt_id: attemptId, receipt };
  });
  const start = vi.fn(async () => "run");
  const inputs = { authority, attemptId };
  const results = await Promise.all([
    dispatchChatFenceOnce(inputs, { claim, start }),
    dispatchChatFenceOnce(inputs, { claim, start }),
  ]);
  expect(results.map(r => r.state).sort()).toEqual(["information_only", "started"]);
  expect((await dispatchChatFenceOnce(inputs, { claim, start })).state).toBe("information_only");
  expect(start).toHaveBeenCalledExactlyOnceWith({ authority, attemptId });
});
it("lost committed claim response never starts and its replay cannot recover permission", async () => {
  const { receipt } = snapshotFixture();
  const start = vi.fn();
  const claim = vi
    .fn()
    .mockRejectedValueOnce(new Error("lost response"))
    .mockResolvedValue({ claimed: false, attempt_id: attemptId, receipt });
  expect(await dispatchChatFenceOnce({ authority, attemptId }, { claim, start })).toMatchObject({
    state: "ambiguous",
    phase: "claim",
  });
  expect((await dispatchChatFenceOnce({ authority, attemptId }, { claim, start })).state).toBe(
    "information_only",
  );
  expect(start).not.toHaveBeenCalled();
});
it("start response loss preserves consumed attempt with no second call or cleanup", async () => {
  const { receipt } = snapshotFixture();
  const start = vi.fn().mockRejectedValue(new Error("unknown start"));
  const claim = vi
    .fn()
    .mockResolvedValueOnce({ claimed: true, attempt_id: attemptId, receipt })
    .mockResolvedValue({ claimed: false, attempt_id: attemptId, receipt });
  expect(await dispatchChatFenceOnce({ authority, attemptId }, { claim, start })).toMatchObject({
    state: "ambiguous",
    phase: "start",
    attemptId,
  });
  expect((await dispatchChatFenceOnce({ authority, attemptId }, { claim, start })).state).toBe(
    "information_only",
  );
  expect(start).toHaveBeenCalledTimes(1);
});
it("closed original and malformed permission never start", async () => {
  const { receipt } = snapshotFixture();
  const start = vi.fn();
  for (const value of [
    { claimed: false, attempt_id: null, receipt: { ...receipt, closed: true } },
    { claimed: true, attempt_id: attemptId, receipt: { ...receipt, closed: true } },
  ]) {
    expect(
      (await dispatchChatFenceOnce({ authority, attemptId }, { claim: async () => value, start }))
        .state,
    ).not.toBe("started");
  }
  expect(start).not.toHaveBeenCalled();
});
