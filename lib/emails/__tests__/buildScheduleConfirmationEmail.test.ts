import { describe, it, expect, vi, beforeEach } from "vitest";
import { CHAT_APP_URL } from "@/lib/const";

const mockGetEmailFooter = vi.fn();
vi.mock("@/lib/emails/getEmailFooter", () => ({
  getEmailFooter: (...args: unknown[]) => mockGetEmailFooter(...args),
}));

const { buildScheduleConfirmationEmail } = await import(
  "../buildScheduleConfirmationEmail"
);

const params = {
  title: "Weekly valuation + streams report",
  cadence: "Mondays at 13:00 UTC",
};

describe("buildScheduleConfirmationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEmailFooter.mockReturnValue("<footer>reply note</footer>");
  });

  it("names the report and when it runs, so the signup knows what to expect", () => {
    const { subject, html } = buildScheduleConfirmationEmail(params);

    expect(subject).toContain("Weekly valuation + streams report");
    expect(html).toContain("Mondays at 13:00 UTC");
  });

  it("points the CTA at the account's tasks", () => {
    const { html } = buildScheduleConfirmationEmail(params);

    expect(html).toContain(`href="${CHAT_APP_URL}/tasks"`);
  });

  it("renders through the shared layout, so it reads as one family with the others", () => {
    const { html } = buildScheduleConfirmationEmail(params);

    expect(html).toContain("<footer>reply note</footer>");
    expect(html).toContain("Recoup");
  });

  it("contains no em or en dashes in outward-facing copy", () => {
    const { subject, html } = buildScheduleConfirmationEmail(params);

    expect(subject).not.toMatch(/[–—]/);
    expect(html).not.toMatch(/[–—]/);
  });
});
