import { describe, it, expect } from "vitest";
import { resolveEmailSubject, DEFAULT_EMAIL_SUBJECT } from "../resolveEmailSubject";

describe("resolveEmailSubject", () => {
  it("returns the provided subject when non-empty", () => {
    expect(resolveEmailSubject({ subject: "Weekly report", text: "# Pulse" })).toBe(
      "Weekly report",
    );
  });

  it("trims the provided subject", () => {
    expect(resolveEmailSubject({ subject: "  Hi  " })).toBe("Hi");
  });

  it("derives from the text body's first heading (stripping leading #)", () => {
    expect(resolveEmailSubject({ text: "# Pulse Report\n\nbody here" })).toBe("Pulse Report");
  });

  it("derives from the first non-empty line of plain text", () => {
    expect(resolveEmailSubject({ subject: "", text: "\n\nHello there\nmore" })).toBe("Hello there");
  });

  it("derives from html when no text (tags stripped)", () => {
    expect(resolveEmailSubject({ html: "<h1>Launch day</h1><p>details</p>" })).toBe("Launch day");
  });

  it("falls back to the default when the body is empty", () => {
    expect(resolveEmailSubject({})).toBe(DEFAULT_EMAIL_SUBJECT);
    expect(resolveEmailSubject({ subject: "   ", text: "   ", html: "" })).toBe(
      DEFAULT_EMAIL_SUBJECT,
    );
  });

  it("caps a very long derived subject", () => {
    const long = "x".repeat(300);
    const result = resolveEmailSubject({ text: long });
    expect(result.length).toBeLessThanOrEqual(120);
  });
});
