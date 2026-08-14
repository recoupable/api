import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { handleResumeChatStream } from "@/lib/chat/handleResumeChatStream";
import { validateChatOwnership } from "@/lib/chat/validateChatOwnership";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";
import { getRun } from "workflow/api";

vi.mock("@/lib/chat/validateChatOwnership", () => ({ validateChatOwnership: vi.fn() }));
vi.mock("@/lib/chat/compareAndSetChatActiveStreamId", () => ({
  compareAndSetChatActiveStreamId: vi.fn(),
}));
vi.mock("workflow/api", () => ({ getRun: vi.fn() }));

const CHAT_ID = "11111111-2222-3333-4444-555555555555";
const RUN_ID = "wrun_01ABC";

const request = (qs = "") =>
  new NextRequest(`https://api.test/api/chat/${CHAT_ID}/stream${qs}`, { method: "GET" });

/** Validator resolves with a chat carrying the given active_stream_id. */
function withChat(activeStreamId: string | null) {
  vi.mocked(validateChatOwnership).mockResolvedValue({
    auth: { accountId: "acc-1" },
    chat: { id: CHAT_ID, active_stream_id: activeStreamId },
  } as never);
}

function withRun(
  status: string,
  getReadable = vi.fn(() => Object.assign(new ReadableStream(), { getTailIndex: async () => 41 })),
) {
  vi.mocked(getRun).mockReturnValue({
    get status() {
      return Promise.resolve(status);
    },
    getReadable,
  } as never);
  return getReadable;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({
    ok: true,
    claimed: true,
  } as never);
});

describe("handleResumeChatStream", () => {
  it("returns 204 when the chat has no active stream", async () => {
    withChat(null);

    const res = await handleResumeChatStream(request(), CHAT_ID);

    expect(res.status).toBe(204);
    expect(getRun).not.toHaveBeenCalled();
  });

  it("returns 204 and clears the stale id when the run is already terminal", async () => {
    withChat(RUN_ID);
    withRun("completed");

    const res = await handleResumeChatStream(request(), CHAT_ID);

    expect(res.status).toBe(204);
    expect(compareAndSetChatActiveStreamId).toHaveBeenCalledWith(CHAT_ID, RUN_ID, null);
  });

  it("streams the run and advertises the run id when the run is live", async () => {
    withChat(RUN_ID);
    withRun("running");

    const res = await handleResumeChatStream(request(), CHAT_ID);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-workflow-run-id")).toBe(RUN_ID);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("forwards startIndex to getReadable so a reconnect skips chunks already seen", async () => {
    withChat(RUN_ID);
    const getReadable = withRun("running");

    await handleResumeChatStream(request("?startIndex=12"), CHAT_ID);

    expect(getReadable).toHaveBeenCalledWith(expect.objectContaining({ startIndex: 12 }));
  });

  it("omits startIndex when absent so a fresh reader gets the whole turn", async () => {
    withChat(RUN_ID);
    const getReadable = withRun("running");

    await handleResumeChatStream(request(), CHAT_ID);

    expect(getReadable).toHaveBeenCalledWith(expect.objectContaining({ startIndex: undefined }));
  });

  it("returns 400 for a malformed startIndex without touching the run", async () => {
    withChat(RUN_ID);
    withRun("running");

    const res = await handleResumeChatStream(request("?startIndex=-3"), CHAT_ID);

    expect(res.status).toBe(400);
    expect(getRun).not.toHaveBeenCalled();
  });

  it("propagates the validator's response (401/403/404) unchanged", async () => {
    vi.mocked(validateChatOwnership).mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }) as never,
    );

    const res = await handleResumeChatStream(request(), CHAT_ID);

    expect(res.status).toBe(403);
    expect(getRun).not.toHaveBeenCalled();
  });

  // A transient workflow-API failure must not be reported as "nothing to
  // resume" — that would tell a client with a live run to stop reconnecting.
  it("returns 502 rather than 204 when the run status lookup throws", async () => {
    withChat(RUN_ID);
    vi.mocked(getRun).mockReturnValue({
      get status() {
        return Promise.reject(new Error("workflow api down"));
      },
      getReadable: vi.fn(),
    } as never);

    const res = await handleResumeChatStream(request(), CHAT_ID);

    expect(res.status).toBe(502);
    expect(compareAndSetChatActiveStreamId).not.toHaveBeenCalled();
  });

  // Upstream open-agents returns this so the client knows which startIndex to
  // send on its next reconnect; the SDK's WorkflowChatTransport reads it to
  // compute absolute chunk positions. Without it a reconnect replays from 0.
  it("advertises the stream tail index so the client can resume precisely", async () => {
    withChat(RUN_ID);
    withRun("running");

    const res = await handleResumeChatStream(request(), CHAT_ID);

    expect(res.headers.get("x-workflow-stream-tail-index")).toBe("41");
  });

  it("still streams when the tail index cannot be read", async () => {
    withChat(RUN_ID);
    withRun(
      "running",
      vi.fn(() =>
        Object.assign(new ReadableStream(), {
          getTailIndex: async () => {
            throw new Error("unsupported");
          },
        }),
      ),
    );

    const res = await handleResumeChatStream(request(), CHAT_ID);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-workflow-stream-tail-index")).toBeNull();
  });
});
