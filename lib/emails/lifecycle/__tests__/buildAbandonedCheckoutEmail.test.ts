import { describe, it, expect } from "vitest";
import { CHAT_APP_URL } from "@/lib/const";
import { buildAbandonedCheckoutEmail } from "../buildAbandonedCheckoutEmail";

describe("buildAbandonedCheckoutEmail", () => {
  it("returns plain text that offers help setting up the first report", () => {
    const { subject, text } = buildAbandonedCheckoutEmail({ plan: "pro" });

    expect(subject).toBe("Want a hand setting up your first report?");
    expect(text).toContain("Pro");
    expect(text).toContain("first report");
    expect(text).toContain(CHAT_APP_URL);
    expect(text).toMatch(/reply/i);
    expect(text).not.toMatch(/<[^>]+>/);
  });

  it("names the Starter plan when that checkout was abandoned", () => {
    const { text } = buildAbandonedCheckoutEmail({ plan: "starter" });
    expect(text).toContain("Starter");
    expect(text).not.toContain("Pro plan");
  });

  it("never uses em or en dashes in the copy", () => {
    const { subject, text } = buildAbandonedCheckoutEmail({ plan: "pro" });
    expect(`${subject}${text}`).not.toMatch(/[–—]/);
  });
});
