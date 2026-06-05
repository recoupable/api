import { describe, it, expect, vi, beforeEach } from "vitest";
import { gateChatStreamStart } from "@/lib/chat/gateChatStreamStart";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";

vi.mock("@/lib/chat/reconcileExistingActiveStream", () => ({
  reconcileExistingActiveStream: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const CHAT_ID = "chat-1";

describe("gateChatStreamStart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null and skips reconcile when there is no active stream id", async () => {
    const result = await gateChatStreamStart(CHAT_ID, null);

    expect(result).toBeNull();
    expect(reconcileExistingActiveStream).not.toHaveBeenCalled();
  });

  it("returns a 409 when a run is genuinely live (resume)", async () => {
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({
      action: "resume",
      runId: "wrun_live",
      stream: new ReadableStream(),
    });

    const result = await gateChatStreamStart(CHAT_ID, "wrun_live");

    expect(reconcileExistingActiveStream).toHaveBeenCalledWith(CHAT_ID, "wrun_live");
    expect(result?.status).toBe(409);
  });

  it("returns a 503 when stream state is indeterminate (conflict)", async () => {
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "conflict" });

    const result = await gateChatStreamStart(CHAT_ID, "wrun_stale");

    expect(result?.status).toBe(503);
  });

  it("returns null so the caller starts fresh when a terminal stale id was cleared (ready)", async () => {
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "ready" });

    const result = await gateChatStreamStart(CHAT_ID, "wrun_done");

    expect(result).toBeNull();
  });
});
