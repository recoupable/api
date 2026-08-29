import { describe, it, expect } from "vitest";
import { buildTrialEndingEmail } from "../buildTrialEndingEmail";

const args = {
  reportsSent: 12,
  creditsUsedUsd: 14.5,
  trialEndsOn: "2026-09-27",
  priceLine: "$99.00/month",
  portalUrl: "https://billing.stripe.com/p/session/test_123",
};

describe("buildTrialEndingEmail", () => {
  it("summarises the trial with real numbers and the conversion date", () => {
    const { subject, html } = buildTrialEndingEmail(args);

    expect(subject).toBe("Your Recoup trial ends on 2026-09-27");
    expect(html).toContain("12 reports");
    expect(html).toContain("$14.50");
    expect(html).toContain("2026-09-27");
    expect(html).toContain("$99.00/month");
  });

  it("says what stops at day 30 and links the billing portal for cancelling", () => {
    const { html } = buildTrialEndingEmail(args);

    expect(html).toContain("Daily social monitoring");
    expect(html).toContain("Scheduled reports");
    expect(html).toContain(args.portalUrl);
    expect(html).toContain("cancel");
  });

  it("uses singular wording for one report and never uses em or en dashes", () => {
    const { subject, html } = buildTrialEndingEmail({ ...args, reportsSent: 1 });
    expect(html).toContain("1 report ");
    expect(`${subject}${html}`).not.toMatch(/[–—]/);
  });
});
