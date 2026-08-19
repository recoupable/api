import { describe, it, expect } from "vitest";
import { toValuationEmailOutcome } from "../toValuationEmailOutcome";

describe("toValuationEmailOutcome", () => {
  it("maps a successful send", () => {
    expect(toValuationEmailOutcome({ sent: true, resendId: "re_1" })).toEqual({
      status: "sent",
    });
  });

  it("maps the dedup skip", () => {
    expect(toValuationEmailOutcome({ sent: false, skipped: "already_sent" })).toEqual({
      status: "skipped",
      reason: "already sent",
    });
  });

  it("maps the missing-recipient skip", () => {
    expect(toValuationEmailOutcome({ sent: false, skipped: "no_email" })).toEqual({
      status: "skipped",
      reason: "no email on account",
    });
  });

  it("maps a Resend failure", () => {
    expect(toValuationEmailOutcome({ sent: false, error: "rate limited" })).toEqual({
      status: "failed",
      error: "rate limited",
    });
  });
});
