import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";

import { getRun } from "workflow/api";
import { compareAndSetChatActiveStreamId } from "@/lib/supabase/chats/compareAndSetChatActiveStreamId";
import { selectChats } from "@/lib/supabase/chats/selectChats";

vi.mock("workflow/api", () => ({
  getRun: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/compareAndSetChatActiveStreamId", () => ({
  compareAndSetChatActiveStreamId: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/selectChats", () => ({
  selectChats: vi.fn(),
}));

const CHAT_ID = "chat-1";

beforeEach(() => vi.clearAllMocks());

function mockRun(status: string, getReadable = () => new ReadableStream()) {
  vi.mocked(getRun).mockReturnValue({
    status: Promise.resolve(status),
    getReadable,
  } as never);
}

describe("reconcileExistingActiveStream", () => {
  it("returns action=resume with the stream when the workflow is still running", async () => {
    const fakeStream = new ReadableStream();
    mockRun("running", () => fakeStream);
    const result = await reconcileExistingActiveStream(CHAT_ID, "run-1");
    expect(result.action).toBe("resume");
    if (result.action !== "resume") return;
    expect(result.runId).toBe("run-1");
    expect(result.stream).toBe(fakeStream);
  });

  it("returns action=resume when status is 'pending'", async () => {
    mockRun("pending");
    const result = await reconcileExistingActiveStream(CHAT_ID, "run-1");
    expect(result.action).toBe("resume");
  });

  it("returns action=ready after clearing a completed run via CAS", async () => {
    mockRun("completed");
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(true);
    const result = await reconcileExistingActiveStream(CHAT_ID, "run-1");
    expect(result.action).toBe("ready");
    expect(compareAndSetChatActiveStreamId).toHaveBeenCalledWith(CHAT_ID, "run-1", null);
  });

  it("returns action=ready when getRun throws (run not found) and CAS clears the stale id", async () => {
    vi.mocked(getRun).mockImplementation(() => {
      throw new Error("run not found");
    });
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(true);
    const result = await reconcileExistingActiveStream(CHAT_ID, "stale-run");
    expect(result.action).toBe("ready");
  });

  it("retries with the latest activeStreamId from the chat row if CAS fails", async () => {
    mockRun("completed");
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(false);
    vi.mocked(selectChats).mockResolvedValue([{ id: CHAT_ID, active_stream_id: "run-2" } as never]);
    // 2nd iteration: run-2 is running → resume
    vi.mocked(getRun)
      .mockReturnValueOnce({
        status: Promise.resolve("completed"),
        getReadable: () => new ReadableStream(),
      } as never)
      .mockReturnValueOnce({
        status: Promise.resolve("running"),
        getReadable: () => new ReadableStream(),
      } as never);

    const result = await reconcileExistingActiveStream(CHAT_ID, "run-1");
    expect(result.action).toBe("resume");
    if (result.action !== "resume") return;
    expect(result.runId).toBe("run-2");
  });

  it("returns action=conflict after MAX attempts without resolution", async () => {
    mockRun("completed");
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue(false);
    vi.mocked(selectChats).mockResolvedValue([
      { id: CHAT_ID, active_stream_id: "still-active" } as never,
    ]);
    const result = await reconcileExistingActiveStream(CHAT_ID, "run-1");
    expect(result.action).toBe("conflict");
  });
});
