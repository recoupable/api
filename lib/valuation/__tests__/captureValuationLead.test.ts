import { describe, it, expect, vi, beforeEach } from "vitest";
import { captureValuationLead } from "@/lib/valuation/captureValuationLead";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { upsertValuationLead } from "@/lib/valuation/upsertValuationLead";
import { sendMessage } from "@/lib/telegram/sendMessage";

vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: vi.fn() }));
vi.mock("@/lib/valuation/upsertValuationLead", () => ({ upsertValuationLead: vi.fn() }));
vi.mock("@/lib/telegram/sendMessage", () => ({ sendMessage: vi.fn() }));

const input = {
  accountId: "acc_1",
  artistName: "Mac Miller",
  artistId: "4LLpKhyESsyAXpc4laK94U",
  // api valuation band shape ({ low, mid, high }); the lead's "central" is `mid`.
  valueBand: { low: 37_500_000, mid: 54_600_000, high: 76_800_000 },
  lifetimeStreams: 22_000_000_000,
  followerCount: 13_000_000,
};

describe("captureValuationLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(selectAccountEmails).mockResolvedValue([{ email: "artist@example.com" }] as Awaited<
      ReturnType<typeof selectAccountEmails>
    >);
    vi.mocked(upsertValuationLead).mockResolvedValue({
      success: true,
      recordUrl: "https://app.attio.com/recoup/person/rec_1/overview",
    });
  });

  it("resolves the owner's email from the account and upserts the lead (mid → central)", async () => {
    await captureValuationLead(input);

    expect(selectAccountEmails).toHaveBeenCalledWith({ accountIds: "acc_1" });
    expect(upsertValuationLead).toHaveBeenCalledWith({
      email: "artist@example.com",
      artistName: "Mac Miller",
      artistId: "4LLpKhyESsyAXpc4laK94U",
      valueBand: { low: 37_500_000, central: 54_600_000, high: 76_800_000 },
      lifetimeStreams: 22_000_000_000,
      followerCount: 13_000_000,
    });
  });

  it("pings Telegram with the lead + value band + Attio deep link", async () => {
    await captureValuationLead(input);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const msg = vi.mocked(sendMessage).mock.calls[0][0] as string;
    expect(msg).toContain("💰 Valuation lead");
    expect(msg).toContain("artist@example.com");
    expect(msg).toContain("Mac Miller");
    expect(msg).toContain("$54,600,000");
    expect(msg).toContain("$37,500,000–$76,800,000");
    expect(msg).toContain("https://app.attio.com/recoup/person/rec_1/overview");
  });

  it("skips entirely (no Attio, no Telegram) when the account has no email", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue(
      [] as Awaited<ReturnType<typeof selectAccountEmails>>,
    );
    await captureValuationLead(input);
    expect(upsertValuationLead).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("still pings Telegram (without a link) and logs when the Attio upsert fails", async () => {
    vi.mocked(upsertValuationLead).mockResolvedValue({ success: false, error: "boom" });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await captureValuationLead(input);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const msg = vi.mocked(sendMessage).mock.calls[0][0] as string;
    expect(msg).not.toContain("Attio:");
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("never throws when Telegram fails (best-effort)", async () => {
    vi.mocked(sendMessage).mockRejectedValue(new Error("telegram down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(captureValuationLead(input)).resolves.toBeUndefined();
    errSpy.mockRestore();
  });

  it("omits optional signals from the lead when they are not known", async () => {
    const { lifetimeStreams: _s, followerCount: _f, ...minimal } = input;
    await captureValuationLead(minimal);
    const lead = vi.mocked(upsertValuationLead).mock.calls[0][0];
    expect(lead).not.toHaveProperty("lifetimeStreams");
    expect(lead).not.toHaveProperty("followerCount");
  });
});
