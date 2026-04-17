import { describe, it, expect } from "vitest";
import { parseEmailString } from "../parseEmailString";

describe("parseEmailString", () => {
  it('extracts email from "Name <email>" format', () => {
    expect(parseEmailString('"sweetman eth" <sweetmantech@gmail.com>')).toBe(
      "sweetmantech@gmail.com",
    );
  });

  it("extracts email from <email> (no display name)", () => {
    expect(parseEmailString("<sender@example.com>")).toBe("sender@example.com");
  });

  it("returns a bare email untouched", () => {
    expect(parseEmailString("jessica@rostrumrecords.com")).toBe("jessica@rostrumrecords.com");
  });

  it("returns null for empty string", () => {
    expect(parseEmailString("")).toBeNull();
  });

  it("returns null when no email is present", () => {
    expect(parseEmailString("no email here")).toBeNull();
  });
});
