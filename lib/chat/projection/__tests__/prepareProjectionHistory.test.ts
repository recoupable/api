import { expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { prepareProjectionHistory } from "../prepareProjectionHistory";
import { prepareAuthorizedProjectionHistory } from "../prepareAuthorizedProjectionHistory";
const observation = {
  type: "data-recoup-sdk-observation",
  id: "a:projection:0",
  data: { fallback: { partIndex: 2 } },
};
const tool = {
  type: "tool-answer",
  toolCallId: "call",
  state: "output-available",
  output: "user edit",
};
const message = {
  id: "a",
  role: "assistant",
  metadata: { retained: true },
  parts: [
    tool,
    observation,
    { type: "text", text: "fallback", state: "done" },
    { type: "text", text: "unrelated" },
  ],
} as UIMessage;
it("restores only the verified span and preserves canonical and tool edits", async () => {
  const original = { type: "custom", kind: "provider.content" } as const;
  const verify = vi.fn(async () => original);
  const input = [structuredClone(message)];
  const result = await prepareProjectionHistory(input, verify);
  expect(result.canonical).toBe(input);
  expect(result.canonical[0].parts).toEqual(message.parts);
  expect(result.native[0].parts).toEqual([tool, original, message.parts[3]]);
  expect(result.native[0].metadata).toEqual(message.metadata);
  expect(verify).toHaveBeenCalledWith(input[0].parts[1], input[0]);
});
it("never changes history or accepts fallback on verification failure", async () => {
  const input = [structuredClone(message)];
  await expect(
    prepareProjectionHistory(input, async () => {
      throw new Error("refused");
    }),
  ).rejects.toThrow("refused");
  expect(input).toEqual([message]);
});
it.each(["user", "system"])("rejects reserved observations in %s messages", async role => {
  const verify = vi.fn();
  await expect(
    prepareProjectionHistory([{ ...message, role } as UIMessage], verify),
  ).rejects.toMatchObject({ code: "producer_mismatch" });
  expect(verify).not.toHaveBeenCalled();
});
it("rejects unadmitted observations without opening a World", async () => {
  await expect(
    prepareAuthorizedProjectionHistory(
      [message],
      { accountId: "a", chatId: "c", sessionId: "s" },
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "producer_mismatch" });
});
it("rejects a shifted pair before invoking evidence reads", async () => {
  const verify = vi.fn();
  await expect(
    prepareProjectionHistory([{ ...message, parts: message.parts.slice(1) }], verify),
  ).rejects.toMatchObject({ code: "span_mismatch" });
  expect(verify).not.toHaveBeenCalled();
});
it.each(["custom", "reasoning-file", "tool-approval-request", "tool-approval-response"])(
  "rejects unproven native %s parts from history",
  async type => {
    await expect(
      prepareProjectionHistory([{ ...message, parts: [{ type } as never] }]),
    ).rejects.toMatchObject({ code: "invalid_observation" });
  },
);
