import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMusicNotification } from "../sendMusicNotification";
import { sendMessage } from "@/lib/telegram/sendMessage";

vi.mock("@/lib/telegram/sendMessage", () => ({ sendMessage: vi.fn() }));

const input = {
  generationId: "11111111-2222-4333-8444-555555555555",
  accountEmail: "artist@label.com",
  prompt: "Genre: lo-fi soul.",
  lyrics: "[verse]",
  durationSeconds: 25.87,
  status: "completed" as const,
};

describe("sendMusicNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the formatted message", async () => {
    await sendMusicNotification(input);

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(vi.mocked(sendMessage).mock.calls[0][0]).toContain("/music/11111111");
  });

  it("skips test accounts so they do not read as customer activity", async () => {
    // isTestEmail matches two exact addresses, not a pattern, so this is the
    // real filter rather than a plus-addressed variant.
    await sendMusicNotification({ ...input, accountEmail: "sweetmantech@gmail.com" });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("still notifies when the account has no email on file", async () => {
    await sendMusicNotification({ ...input, accountEmail: null });

    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it("swallows a Telegram outage rather than failing a paid generation", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(sendMessage).mockRejectedValue(new Error("telegram down"));

    await expect(sendMusicNotification(input)).resolves.toBeUndefined();

    spy.mockRestore();
  });
});
