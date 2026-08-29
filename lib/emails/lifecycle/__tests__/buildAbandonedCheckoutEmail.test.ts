import { describe, it, expect } from "vitest";
import { CHAT_APP_URL } from "@/lib/const";
import { buildAbandonedCheckoutEmail } from "../buildAbandonedCheckoutEmail";

describe("buildAbandonedCheckoutEmail", () => {
  it("offers help setting up the first report and links back to the app", () => {
    const { subject, html } = buildAbandonedCheckoutEmail({ plan: "pro" });

    expect(subject).toBe("Want a hand setting up your first report?");
    expect(html).toContain("Pro");
    expect(html).toContain("first report");
    expect(html).toContain(CHAT_APP_URL);
    expect(html).toContain("reply");
  });

  it("names the Starter plan when that checkout was abandoned", () => {
    const { html } = buildAbandonedCheckoutEmail({ plan: "starter" });
    expect(html).toContain("Starter");
    expect(html).not.toContain("Pro plan");
  });

  it("never uses em or en dashes in the copy", () => {
    const { subject, html } = buildAbandonedCheckoutEmail({ plan: "pro" });
    expect(`${subject}${html}`).not.toMatch(/[–—]/);
  });
});
