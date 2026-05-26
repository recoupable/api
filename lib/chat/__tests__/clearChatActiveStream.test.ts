import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearChatActiveStream } from "@/lib/chat/clearChatActiveStream";
import { compareAndSetChatActiveStreamId } from "@/lib/chat/compareAndSetChatActiveStreamId";

vi.mock("@/lib/chat/compareAndSetChatActiveStreamId", () => ({
  compareAndSetChatActiveStreamId: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

const CHAT_ID = "chat-1";
const RUN_ID = "wrun_test";

describe("clearChatActiveStream", () => {
  it("CAS-clears active_stream_id back to null on the happy path", async () => {
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({
      ok: true,
      claimed: true,
    });

    await clearChatActiveStream(CHAT_ID, RUN_ID);

    expect(compareAndSetChatActiveStreamId).toHaveBeenCalledTimes(1);
    expect(compareAndSetChatActiveStreamId).toHaveBeenCalledWith(CHAT_ID, RUN_ID, null);
  });

  it("returns without throwing when the race is lost (a newer run owns the slot)", async () => {
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({
      ok: true,
      claimed: false,
    });

    await expect(clearChatActiveStream(CHAT_ID, RUN_ID)).resolves.toBeUndefined();
    expect(compareAndSetChatActiveStreamId).toHaveBeenCalledTimes(1);
  });

  it("retries up to 3 times on transient DB errors and stops once a CAS succeeds", async () => {
    vi.mocked(compareAndSetChatActiveStreamId)
      .mockResolvedValueOnce({ ok: false, error: "transient 1" })
      .mockResolvedValueOnce({ ok: true, claimed: true });

    await clearChatActiveStream(CHAT_ID, RUN_ID);

    expect(compareAndSetChatActiveStreamId).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 failed CAS attempts and logs (does not throw)", async () => {
    vi.mocked(compareAndSetChatActiveStreamId).mockResolvedValue({
      ok: false,
      error: "persistent",
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(clearChatActiveStream(CHAT_ID, RUN_ID)).resolves.toBeUndefined();

    expect(compareAndSetChatActiveStreamId).toHaveBeenCalledTimes(3);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("retries on thrown exceptions and gives up after 3 attempts", async () => {
    vi.mocked(compareAndSetChatActiveStreamId).mockRejectedValue(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(clearChatActiveStream(CHAT_ID, RUN_ID)).resolves.toBeUndefined();

    expect(compareAndSetChatActiveStreamId).toHaveBeenCalledTimes(3);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
