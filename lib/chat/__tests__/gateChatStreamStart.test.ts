import { describe, it, expect, vi, beforeEach } from "vitest";
import { gateChatStreamStart } from "@/lib/chat/gateChatStreamStart";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";

vi.mock("@/lib/chat/reconcileExistingActiveStream", () => ({
  reconcileExistingActiveStream: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

beforeEach(() => vi.clearAllMocks());

describe("gateChatStreamStart", () => {
  it("returns null when there is no active_stream_id", async () => {
    const res = await gateChatStreamStart("chat-1", null);
    expect(res).toBeNull();
    expect(reconcileExistingActiveStream).not.toHaveBeenCalled();
  });

  it("returns null when reconcile says action=ready", async () => {
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "ready" });
    const res = await gateChatStreamStart("chat-1", "wrun_dead");
    expect(res).toBeNull();
  });

  it("returns 409 with a GET recovery path instead of silently dropping the new message", async () => {
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({
      action: "resume",
      runId: "wrun_live",
    });
    const res = await gateChatStreamStart("chat-1", "wrun_live");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(409);
    expect(res!.headers.get("x-workflow-run-id")).toBeNull();
    expect(await res!.json()).toMatchObject({ error: expect.stringContaining("GET /api/chat/") });
  });

  it("returns a retryable 503 on an unresolved slot", async () => {
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "conflict" });
    const res = await gateChatStreamStart("chat-1", "wrun_x");
    expect(res!.status).toBe(503);
  });
});
