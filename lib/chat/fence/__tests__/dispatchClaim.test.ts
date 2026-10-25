import { expect, it } from "vitest";
import { chatFenceCommandSchema } from "../chatFenceSchemas";
import { parseChatFenceReceipt } from "../parseChatFenceReceipt";
import { snapshotFixture, requestId } from "./snapshotFixture";
const attempt = "55555555-5555-4555-8555-555555555555";
const command = {
  action: "claim_dispatch" as const,
  payload: { owner: requestId, epoch: 1, attempt_id: attempt },
};
it("accepts the exact one-shot claim and attempt-bound bind commands", () => {
  expect(chatFenceCommandSchema.safeParse(command).success).toBe(true);
  expect(
    chatFenceCommandSchema.safeParse({
      action: "bind",
      payload: { owner: requestId, epoch: 1, run_id: "run", attempt_id: attempt },
    }).success,
  ).toBe(true);
  expect(
    chatFenceCommandSchema.safeParse({
      action: "bind",
      payload: { owner: requestId, epoch: 1, run_id: "run" },
    }).success,
  ).toBe(false);
});
it("distinguishes first permission from information-only replay", () => {
  const { receipt } = snapshotFixture();
  for (const claimed of [true, false]) {
    expect(
      parseChatFenceReceipt("chat", command, { claimed, attempt_id: attempt, receipt }),
    ).toEqual({
      ok: true,
      action: "claim_dispatch",
      value: { claimed, attempt_id: attempt, receipt },
    });
  }
});
it("rejects foreign or impossible permission receipts", () => {
  const { receipt } = snapshotFixture();
  for (const value of [
    { claimed: true, attempt_id: requestId, receipt },
    { claimed: true, attempt_id: null, receipt },
    { claimed: true, attempt_id: attempt, receipt: { ...receipt, closed: true } },
    { claimed: true, attempt_id: attempt, receipt: { ...receipt, bound_run_id: "run" } },
    { claimed: true, attempt_id: attempt, receipt: { ...receipt, epoch: 2 } },
    { claimed: false, attempt_id: attempt, receipt: { ...receipt, chat_id: "foreign" } },
  ])
    expect(parseChatFenceReceipt("chat", command, value).ok).toBe(false);
});
it("returns original attempt on losing replay and enforces snapshot dispatch consistency", () => {
  const { receipt } = snapshotFixture();
  expect(
    parseChatFenceReceipt("chat", command, { claimed: false, attempt_id: requestId, receipt }),
  ).toEqual({
    ok: true,
    action: "claim_dispatch",
    value: { claimed: false, attempt_id: requestId, receipt },
  });
});
