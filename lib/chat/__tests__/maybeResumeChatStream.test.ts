import { describe, it, expect, vi, beforeEach } from "vitest";
import { maybeResumeChatStream } from "@/lib/chat/maybeResumeChatStream";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";

vi.mock("@/lib/chat/reconcileExistingActiveStream", () => ({
  reconcileExistingActiveStream: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

beforeEach(() => vi.clearAllMocks());

describe("maybeResumeChatStream", () => {
  it("returns null when there is no active_stream_id", async () => {
    const res = await maybeResumeChatStream("chat-1", null);
    expect(res).toBeNull();
    expect(reconcileExistingActiveStream).not.toHaveBeenCalled();
  });

  it("returns null when reconcile says action=ready", async () => {
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "ready" });
    const res = await maybeResumeChatStream("chat-1", "wrun_dead");
    expect(res).toBeNull();
  });

  it("returns a 200 SSE response with x-workflow-run-id on resume", async () => {
    const stream = new ReadableStream();
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({
      action: "resume",
      runId: "wrun_live",
      stream,
    });
    const res = await maybeResumeChatStream("chat-1", "wrun_live");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(res!.headers.get("x-workflow-run-id")).toBe("wrun_live");
    expect(res!.headers.get("content-type") ?? "").toMatch(/text\/event-stream/);
  });

  it("returns a 409 on conflict", async () => {
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "conflict" });
    const res = await maybeResumeChatStream("chat-1", "wrun_x");
    expect(res!.status).toBe(409);
  });
});
