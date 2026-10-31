import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getRun } from "workflow/api";
import { handleStopChatWorkflow } from "@/lib/chat/handleStopChatWorkflow";
import { handleResumeChatStream } from "@/lib/chat/handleResumeChatStream";
import { stopFencedChatWorkflow } from "../fence/lifecycle/stopFencedChatWorkflow";
import { resumeFencedChatStream } from "../fence/lifecycle/resumeFencedChatStream";
const { rpc, ownership, stopValidation, cas } = vi.hoisted(() => ({
  rpc: vi.fn(),
  ownership: vi.fn(),
  stopValidation: vi.fn(),
  cas: vi.fn(),
}));
vi.mock("workflow/api", () => ({ getRun: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { rpc } }));
vi.mock("@/lib/chat/validateChatOwnership", () => ({ validateChatOwnership: ownership }));
vi.mock("@/lib/chat/validateStopChatWorkflowRequest", () => ({
  validateStopChatWorkflowRequest: stopValidation,
}));
vi.mock("@/lib/chat/compareAndSetChatActiveStreamId", () => ({
  compareAndSetChatActiveStreamId: cas,
}));
const target = {
  chatId: "chat",
  effectiveAccount: "11111111-1111-4111-8111-111111111111",
  epoch: 1,
  owner: "22222222-2222-4222-8222-222222222222",
  phase: "running" as const,
  runId: "original-run",
};
const request = new NextRequest("https://api.test/stream?streamLifecycle=explicit-stop-v1");
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  cas.mockResolvedValue({ ok: true, claimed: true });
  const validated = {
    auth: { accountId: target.effectiveAccount },
    chat: { id: "chat", active_stream_id: target.runId },
  };
  ownership.mockResolvedValue(validated);
  stopValidation.mockResolvedValue(validated);
  rpc.mockImplementation(async (_name, args) => ({
    data:
      args.p_action === "state"
        ? { chat_id: "chat", phase: "running", epoch: 1, owner: target.owner, run_id: target.runId }
        : args.p_action === "close_unattempted"
          ? { closed: false }
          : { released: true },
    error: null,
  }));
});
afterEach(() => vi.useRealTimers());
it.each(["pending", "cancel-failed", "timeout"])(
  "preserves actual accepted Stop %s status/body contract",
  async mode => {
    let input = target as unknown as Parameters<typeof stopFencedChatWorkflow>[0];
    if (mode === "pending") {
      input = { ...target, phase: "pending", runId: null };
      stopValidation.mockResolvedValue({
        chat: { id: "chat", active_stream_id: "pending-original" },
      });
    }
    const cancel = vi.fn(async () => {
      if (mode === "cancel-failed") throw new Error("synthetic cancellation failure");
    });
    vi.mocked(getRun).mockReturnValue({ cancel, status: Promise.resolve("running") } as never);
    const old = handleStopChatWorkflow(request, "chat");
    const proposed = stopFencedChatWorkflow(input);
    await vi.advanceTimersByTimeAsync(8100);
    const [legacy, fenced] = await Promise.all([old, proposed]);
    expect(fenced.status).toBe(legacy.status);
    expect(await fenced.json()).toEqual(await legacy.json());
    expect(cas).not.toHaveBeenCalled();
    expect(
      rpc.mock.calls.every(
        ([, args]) => args.p_action === (mode === "pending" ? "close_unattempted" : "state"),
      ),
    ).toBe(true);
    if (mode === "pending") {
      expect(getRun).not.toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledTimes(1);
    }
  },
);
it("preserves actual resume status-read failure contract instead of fake completion", async () => {
  vi.mocked(getRun).mockReturnValue({
    get status() {
      return Promise.reject(new Error("synthetic status unavailable"));
    },
  } as never);
  const legacy = await handleResumeChatStream(request, "chat");
  const fenced = await resumeFencedChatStream(target, new URL(request.url));
  expect(fenced.status).toBe(502);
  expect(fenced.status).toBe(legacy.status);
  expect(await fenced.json()).toEqual(await legacy.json());
  expect(cas).not.toHaveBeenCalled();
});
it("preserves finish-only terminal resume shape after successful authoritative release", async () => {
  vi.mocked(getRun).mockReturnValue({ status: Promise.resolve("completed") } as never);
  const legacy = await handleResumeChatStream(request, "chat");
  const fenced = await resumeFencedChatStream(target, new URL(request.url));
  expect(fenced.status).toBe(200);
  expect(await fenced.text()).toEqual(await legacy.text());
  expect(cas).toHaveBeenCalledExactlyOnceWith("chat", target.runId, null);
  expect(rpc.mock.calls.at(-1)![1].p).toMatchObject({
    reason: "external_terminal",
    run_id: target.runId,
    epoch: 1,
    owner: target.owner,
  });
});
