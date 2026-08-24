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

  it("notifies for internal accounts too", async () => {
    // sweetmantech@gmail.com is one of isTestEmail's two matches. Filtering it
    // meant the first live generation of this feature notified nobody: most
    // current music traffic is our own, and an internal generation is exactly
    // the signal this exists to surface.
    await sendMusicNotification({ ...input, accountEmail: "sweetmantech@gmail.com" });

    expect(sendMessage).toHaveBeenCalledOnce();
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
