import { describe, it, expect } from "vitest";
import { pickAccountRecipient } from "../pickAccountRecipient";

describe("pickAccountRecipient", () => {
  it("returns the most recently updated non-empty email", () => {
    expect(
      pickAccountRecipient([
        { email: "old@example.com", updated_at: "2026-01-01T00:00:00Z" },
        { email: null, updated_at: "2026-09-01T00:00:00Z" },
        { email: "new@example.com", updated_at: "2026-06-01T00:00:00Z" },
      ]),
    ).toBe("new@example.com");
  });

  it("returns null when the account has no email", () => {
    expect(pickAccountRecipient([{ email: null }])).toBeNull();
    expect(pickAccountRecipient([])).toBeNull();
  });
});
