import { describe, it, expect } from "vitest";
import { isValidTimeZone } from "../isValidTimeZone";

describe("isValidTimeZone", () => {
  it("accepts canonical IANA zones", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects unknown or malformed zones", () => {
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("America/Nowhere")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("EST5EDT nonsense")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isValidTimeZone(undefined as unknown as string)).toBe(false);
    expect(isValidTimeZone(null as unknown as string)).toBe(false);
  });
});
