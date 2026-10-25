import { beforeEach, expect, it, vi } from "vitest";
import supabase from "@/lib/supabase/serverClient";
import {
  snapshotFixture,
  workflowInput,
  account,
  requestId,
} from "@/lib/chat/fence/__tests__/snapshotFixture";
import { getChatAdmissionSnapshot } from "../getChatAdmissionSnapshot";
import { executeChatFenceCommand } from "../executeChatFenceCommand";
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc: vi.fn() } }));
const scope = {
  chatId: workflowInput.chatId,
  sessionId: workflowInput.sessionId,
  effectiveAccountId: account,
  requestId,
  expectedEpoch: 0,
};
beforeEach(() => vi.clearAllMocks());
it("looks up only the original request and verifies original bytes", async () => {
  const { stored } = snapshotFixture();
  vi.mocked(supabase.rpc).mockResolvedValue({ data: stored, error: null } as never);
  expect(await getChatAdmissionSnapshot(scope)).toEqual({
    ok: true,
    state: "open",
    snapshot: stored,
  });
  expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith("chat_fence_command", {
    p_chat: scope.chatId,
    p_account: account,
    p_action: "admission_snapshot",
    p: { request_id: requestId },
  });
});
it.each(["scope", "missing", "corrupt"])(
  "fails closed for %s without fallback RPCs",
  async kind => {
    const { stored } = snapshotFixture();
    if (kind === "scope") stored.execution_snapshot.sessionId = "new-session";
    if (kind === "corrupt") stored.execution_canonical += " ";
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: kind === "missing" ? null : stored,
      error: kind === "missing" ? { code: "P0002" } : null,
    } as never);
    expect((await getChatAdmissionSnapshot(scope)).ok).toBe(false);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  },
);
it("rejects tampered admission before contacting SQL", async () => {
  const { payload } = snapshotFixture();
  payload.execution_canonical += " ";
  expect(
    (await executeChatFenceCommand(scope.chatId, account, { action: "admit", payload })).ok,
  ).toBe(false);
  expect(supabase.rpc).not.toHaveBeenCalled();
});

it("returns closed original as closed, never substitutes a new owner", async () => {
  const { stored } = snapshotFixture();
  stored.receipt.closed = true;
  vi.mocked(supabase.rpc).mockResolvedValue({ data: stored, error: null } as never);
  expect(await getChatAdmissionSnapshot(scope)).toEqual({
    ok: true,
    state: "closed",
    snapshot: stored,
  });
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
