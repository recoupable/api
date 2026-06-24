import { describe, it, expect } from "vitest";
import { isApiKeyExpired } from "@/lib/keys/isApiKeyExpired";

describe("isApiKeyExpired", () => {
  const now = Date.parse("2026-06-23T00:00:00Z");

  it("treats null/undefined expiry as never-expiring", () => {
    expect(isApiKeyExpired(null, now)).toBe(false);
    expect(isApiKeyExpired(undefined, now)).toBe(false);
  });

  it("is false for a future expiry", () => {
    expect(isApiKeyExpired("2026-06-23T01:00:00Z", now)).toBe(false);
  });

  it("is true at or past the expiry", () => {
    expect(isApiKeyExpired("2026-06-22T23:59:59Z", now)).toBe(true);
    expect(isApiKeyExpired("2026-06-23T00:00:00Z", now)).toBe(true);
  });

  it("treats an unparseable expiry as non-expiring (never lock out)", () => {
    expect(isApiKeyExpired("not-a-date", now)).toBe(false);
  });
});
