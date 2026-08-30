import { describe, it, expect } from "vitest";
import { buildAbandonedCheckoutEmail } from "../buildAbandonedCheckoutEmail";

describe("buildAbandonedCheckoutEmail", () => {
  it("asks what outcome they wanted, as plain text", () => {
    const { subject, text } = buildAbandonedCheckoutEmail({ plan: "pro" });

    expect(subject).toBe("What outcome were you hoping Recoup would help with?");
    expect(text).toContain("checkout");
    expect(text).toContain("Pro");
    expect(text).not.toMatch(/started Pro/i);
    expect(text).toContain("https://www.linkedin.com/in/sweetmantech");
    expect(text).toContain("https://recoupable.dev");
    expect(text).not.toContain("chat.recoupable.dev");
    expect(text).toMatch(/reply/i);
    expect(text).not.toMatch(/<[^>]+>/);
  });

  it("names the Starter plan when that checkout was abandoned", () => {
    const { text } = buildAbandonedCheckoutEmail({ plan: "starter" });
    expect(text).toContain("Starter");
    expect(text).toContain("checkout");
  });

  it("never uses em or en dashes in the copy", () => {
    const { subject, text } = buildAbandonedCheckoutEmail({ plan: "pro" });
    expect(`${subject}${text}`).not.toMatch(/[–—]/);
  });
});
