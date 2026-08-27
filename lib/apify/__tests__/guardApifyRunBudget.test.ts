import { describe, it, expect, vi, beforeEach } from "vitest";
import { guardApifyRunBudget, APIFY_RUN_BUDGET } from "../guardApifyRunBudget";
import { selectApifyScraperRun } from "@/lib/supabase/apify_scraper_runs/selectApifyScraperRun";
import { countApifyScraperRunsForAccount } from "@/lib/supabase/apify_scraper_runs/countApifyScraperRunsForAccount";
import { countApifyRunDescendants } from "../countApifyRunDescendants";
import { sendMessage } from "@/lib/telegram/sendMessage";
import selectAccountEmails from "@/lib/supabase/account_emails/selectAccountEmails";
import { selectSocials } from "@/lib/supabase/socials/selectSocials";

vi.mock("@/lib/supabase/apify_scraper_runs/selectApifyScraperRun", () => ({
  selectApifyScraperRun: vi.fn(),
}));
vi.mock("@/lib/supabase/apify_scraper_runs/countApifyScraperRunsForAccount", () => ({
  countApifyScraperRunsForAccount: vi.fn(),
}));
vi.mock("../countApifyRunDescendants", () => ({ countApifyRunDescendants: vi.fn() }));
vi.mock("@/lib/telegram/sendMessage", () => ({ sendMessage: vi.fn() }));
vi.mock("@/lib/supabase/account_emails/selectAccountEmails", () => ({ default: vi.fn() }));
vi.mock("@/lib/supabase/socials/selectSocials", () => ({ selectSocials: vi.fn() }));

const root = { run_id: "root", parent_run_id: null, account_id: "acc-1", social_id: "s1" };
const comments = {
  run_id: "comments",
  parent_run_id: "root",
  account_id: "acc-1",
  social_id: "s1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(selectApifyScraperRun).mockImplementation(async ({ runId } = {}) => {
    const row = ({ root, comments } as Record<string, unknown>)[runId ?? ""];
    return (row ? [row] : []) as never;
  });
  vi.mocked(countApifyRunDescendants).mockResolvedValue(2);
  vi.mocked(countApifyScraperRunsForAccount).mockResolvedValue(3);
  vi.mocked(sendMessage).mockResolvedValue({} as never);
  vi.mocked(selectAccountEmails).mockResolvedValue([{ email: "sweets@example.com" }] as never);
  vi.mocked(selectSocials).mockResolvedValue([{ id: "s1", username: "sweetman_eth" }] as never);
});

describe("guardApifyRunBudget", () => {
  it("allows a spawn under both caps and sends no alert", async () => {
    const r = await guardApifyRunBudget({ parentRunId: "comments", platform: "instagram" });
    expect(r).toEqual({ allowed: true });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("walks up to the ROOT scrape before counting: the per-scrape cap is on the whole chain, not the immediate parent", async () => {
    await guardApifyRunBudget({ parentRunId: "comments", platform: "instagram" });
    expect(countApifyRunDescendants).toHaveBeenCalledWith("root", APIFY_RUN_BUDGET.perScrape);
    expect(countApifyScraperRunsForAccount).toHaveBeenCalledWith({
      accountId: "acc-1",
      since: expect.any(String),
    });
  });

  it("blocks and alerts once the originating scrape has spawned the per-scrape cap", async () => {
    vi.mocked(countApifyRunDescendants).mockResolvedValue(APIFY_RUN_BUDGET.perScrape);
    const r = await guardApifyRunBudget({ parentRunId: "comments", platform: "instagram" });
    expect(r).toEqual({ allowed: false, reason: "per_scrape_cap" });
    expect(sendMessage).toHaveBeenCalledOnce();
    const text = vi.mocked(sendMessage).mock.calls[0][0];
    // 🚨 for visual identification, the email for user identification (never the bare id)
    expect(text.startsWith("🚨 *Apify run budget tripped*")).toBe(true);
    // the scraped handle, not the Apify run id, is what a human can act on
    expect(text).toMatch(/@sweetman_eth/);
    expect(text).not.toMatch(/\broot\b/);
    expect(text).toMatch(/sweets@example\.com/);
    expect(text).not.toMatch(/acc-1/);
    expect(selectAccountEmails).toHaveBeenCalledWith({ accountIds: "acc-1" });
    expect(selectSocials).toHaveBeenCalledWith({ id: "s1" });
  });

  it("blocks and alerts once the account has started the hourly cap", async () => {
    vi.mocked(countApifyScraperRunsForAccount).mockResolvedValue(
      APIFY_RUN_BUDGET.perAccountPerHour,
    );
    const r = await guardApifyRunBudget({ parentRunId: "comments", platform: "instagram" });
    expect(r).toEqual({ allowed: false, reason: "per_account_hourly_cap" });
    expect(sendMessage).toHaveBeenCalledOnce();
    const text = vi.mocked(sendMessage).mock.calls[0][0];
    expect(text.startsWith("🚨 *Apify run budget tripped*")).toBe(true);
    expect(text).toMatch(/@sweetman_eth/);
    expect(text).toMatch(/sweets@example\.com/);
    expect(text).not.toMatch(/acc-1/);
  });

  it("falls back to the run id when the root run has no social linked", async () => {
    vi.mocked(selectSocials).mockResolvedValue([]);
    vi.mocked(countApifyRunDescendants).mockResolvedValue(APIFY_RUN_BUDGET.perScrape);
    await guardApifyRunBudget({ parentRunId: "comments", platform: "instagram" });
    expect(vi.mocked(sendMessage).mock.calls[0][0]).toMatch(/\broot\b/);
  });

  it("falls back to the account id in the alert when the account has no email", async () => {
    vi.mocked(selectAccountEmails).mockResolvedValue([]);
    vi.mocked(countApifyScraperRunsForAccount).mockResolvedValue(
      APIFY_RUN_BUDGET.perAccountPerHour,
    );
    await guardApifyRunBudget({ parentRunId: "comments", platform: "instagram" });
    expect(vi.mocked(sendMessage).mock.calls[0][0]).toMatch(/acc-1/);
  });

  it("allows when the parent is unregistered (no chain to budget; the origin guard already makes it terminal)", async () => {
    vi.mocked(selectApifyScraperRun).mockResolvedValue([]);
    const r = await guardApifyRunBudget({ parentRunId: "legacy", platform: "instagram" });
    expect(r).toEqual({ allowed: true });
    expect(countApifyRunDescendants).not.toHaveBeenCalled();
  });

  it("a Telegram failure does not turn a block into an allow, and never throws", async () => {
    vi.mocked(countApifyRunDescendants).mockResolvedValue(999);
    vi.mocked(sendMessage).mockRejectedValue(new Error("telegram down"));
    await expect(
      guardApifyRunBudget({ parentRunId: "comments", platform: "instagram" }),
    ).resolves.toEqual({ allowed: false, reason: "per_scrape_cap" });
  });

  it("fails open on a database error (a bookkeeping outage must not stop persistence), with a log", async () => {
    vi.mocked(selectApifyScraperRun).mockRejectedValue(new Error("db down"));
    const r = await guardApifyRunBudget({ parentRunId: "comments", platform: "instagram" });
    expect(r).toEqual({ allowed: true });
  });
});
