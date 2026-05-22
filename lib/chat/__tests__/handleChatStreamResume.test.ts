import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { handleChatStreamResume } from "@/lib/chat/handleChatStreamResume";
import { validateGetChatStreamRequest } from "@/lib/chat/validateGetChatStreamRequest";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";

vi.mock("@/lib/chat/validateGetChatStreamRequest", () => ({
  validateGetChatStreamRequest: vi.fn(),
}));
vi.mock("@/lib/chat/reconcileExistingActiveStream", () => ({
  reconcileExistingActiveStream: vi.fn(),
}));
vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

const ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CHAT_ID = "11111111-1111-1111-1111-111111111111";

function makeRequest(): NextRequest {
  return new NextRequest(`http://localhost/api/chat/${CHAT_ID}/stream`, {
    method: "GET",
    headers: { "x-api-key": "test-key" },
  });
}

function mockValidatedChat(activeStreamId: string | null) {
  vi.mocked(validateGetChatStreamRequest).mockResolvedValue({
    chat: { id: CHAT_ID, active_stream_id: activeStreamId } as never,
    accountId: ACCOUNT_ID,
  });
}

beforeEach(() => vi.clearAllMocks());

describe("handleChatStreamResume", () => {
  it("passes through the validator's error response", async () => {
    vi.mocked(validateGetChatStreamRequest).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 }),
    );
    const res = await handleChatStreamResume(makeRequest(), CHAT_ID);
    expect(res.status).toBe(403);
    expect(reconcileExistingActiveStream).not.toHaveBeenCalled();
  });

  it("returns 204 when the chat has no active stream id", async () => {
    mockValidatedChat(null);
    const res = await handleChatStreamResume(makeRequest(), CHAT_ID);
    expect(res.status).toBe(204);
    expect(reconcileExistingActiveStream).not.toHaveBeenCalled();
  });

  it("returns 200 with the live stream and x-workflow-run-id when resumable", async () => {
    mockValidatedChat("wrun_live");
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({
      action: "resume",
      runId: "wrun_live",
      stream: new ReadableStream(),
    });
    const res = await handleChatStreamResume(makeRequest(), CHAT_ID);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/text\/event-stream/);
    expect(res.headers.get("x-workflow-run-id")).toBe("wrun_live");
  });

  it("returns 204 when the run is terminal (reconcile=ready, stale id cleared)", async () => {
    mockValidatedChat("wrun_done");
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "ready" });
    const res = await handleChatStreamResume(makeRequest(), CHAT_ID);
    expect(res.status).toBe(204);
  });

  it("returns 204 when the probe is indeterminate (reconcile=conflict)", async () => {
    mockValidatedChat("wrun_unknown");
    vi.mocked(reconcileExistingActiveStream).mockResolvedValue({ action: "conflict" });
    const res = await handleChatStreamResume(makeRequest(), CHAT_ID);
    expect(res.status).toBe(204);
  });
});
