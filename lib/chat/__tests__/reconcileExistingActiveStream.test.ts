import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconcileExistingActiveStream } from "@/lib/chat/reconcileExistingActiveStream";
import { getRun } from "workflow/api";
import { updateChat } from "@/lib/supabase/chats/updateChat";

vi.mock("workflow/api", () => ({
  getRun: vi.fn(),
}));
vi.mock("@/lib/supabase/chats/updateChat", () => ({
  updateChat: vi.fn(),
}));

const CHAT_ID = "chat-1";
const RUN_ID = "wrun_test";

beforeEach(() => vi.clearAllMocks());

function mockRun(status: string, getReadable: () => ReadableStream = () => new ReadableStream()) {
  vi.mocked(getRun).mockReturnValue({
    status: Promise.resolve(status),
    getReadable,
  } as never);
}

describe("reconcileExistingActiveStream", () => {
  it("returns action=resume when status is 'running'", async () => {
    const stream = new ReadableStream();
    mockRun("running", () => stream);
    const result = await reconcileExistingActiveStream(CHAT_ID, RUN_ID);
    expect(result.action).toBe("resume");
    if (result.action !== "resume") return;
    expect(result.runId).toBe(RUN_ID);
    expect(result.stream).toBe(stream);
  });

  it("returns action=resume when status is 'pending'", async () => {
    mockRun("pending");
    const result = await reconcileExistingActiveStream(CHAT_ID, RUN_ID);
    expect(result.action).toBe("resume");
  });

  it("returns action=ready after CASing a completed run's stale id to null", async () => {
    mockRun("completed");
    vi.mocked(updateChat).mockResolvedValue({ ok: true, rowsUpdated: 1, row: null });
    const result = await reconcileExistingActiveStream(CHAT_ID, RUN_ID);
    expect(result.action).toBe("ready");
    expect(updateChat).toHaveBeenCalledWith(
      { id: CHAT_ID, whereActiveStreamId: { equals: RUN_ID } },
      { active_stream_id: null },
    );
  });

  it("returns action=conflict when getRun throws (transient workflow API error)", async () => {
    vi.mocked(getRun).mockImplementation(() => {
      throw new Error("workflow API unreachable");
    });
    const result = await reconcileExistingActiveStream(CHAT_ID, RUN_ID);
    expect(result.action).toBe("conflict");
    // Critical: we do NOT clear the stream id on transient error.
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("returns action=conflict when status promise rejects", async () => {
    // Wrap in a thenable that defers the rejection so Vitest's
    // unhandled-rejection watcher doesn't flag it before the code awaits.
    const rejection: Promise<string> = (async () => {
      throw new Error("status fetch failed");
    })();
    rejection.catch(() => {
      /* attach a handler so it's not 'unhandled' before the SUT awaits */
    });
    vi.mocked(getRun).mockReturnValue({
      status: rejection,
      getReadable: () => new ReadableStream(),
    } as never);
    const result = await reconcileExistingActiveStream(CHAT_ID, RUN_ID);
    expect(result.action).toBe("conflict");
    expect(updateChat).not.toHaveBeenCalled();
  });

  it("returns action=conflict when CAS-clear loses the race (rowsUpdated=0)", async () => {
    mockRun("completed");
    vi.mocked(updateChat).mockResolvedValue({ ok: true, rowsUpdated: 0, row: null });
    const result = await reconcileExistingActiveStream(CHAT_ID, RUN_ID);
    expect(result.action).toBe("conflict");
  });

  it("returns action=conflict when CAS-clear hits a DB error (ok:false)", async () => {
    mockRun("completed");
    vi.mocked(updateChat).mockResolvedValue({ ok: false, error: "down" });
    const result = await reconcileExistingActiveStream(CHAT_ID, RUN_ID);
    // P1 fix: a failed re-read after CAS no longer falls through to "ready".
    expect(result.action).toBe("conflict");
  });
});
