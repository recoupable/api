import { describe, it, expect } from "vitest";
import { extractSenderEmail } from "../extractSenderEmail";

describe("extractSenderEmail", () => {
  it('parses "Name <email>" format from headers.from', () => {
    const result = extractSenderEmail({
      headers: { from: '"sweetman eth" <sweetmantech@gmail.com>' },
      replyTo: null,
      envelopeFrom: "agent@mail.recoupable.com",
    });
    expect(result).toBe("sweetmantech@gmail.com");
  });

  it("returns bare email from headers.from when no display name", () => {
    const result = extractSenderEmail({
      headers: { from: "jessica@rostrumrecords.com" },
      replyTo: null,
      envelopeFrom: "agent@mail.recoupable.com",
    });
    expect(result).toBe("jessica@rostrumrecords.com");
  });

  it("prefers headers.from over reply_to when both are present", () => {
    const result = extractSenderEmail({
      headers: { from: "<real-sender@example.com>" },
      replyTo: ["reply-here@example.com"],
      envelopeFrom: "agent@mail.recoupable.com",
    });
    expect(result).toBe("real-sender@example.com");
  });

  it("falls back to reply_to[0] when headers.from is missing", () => {
    const result = extractSenderEmail({
      headers: {},
      replyTo: ["jessica@rostrumrecords.com"],
      envelopeFrom: "agent@mail.recoupable.com",
    });
    expect(result).toBe("jessica@rostrumrecords.com");
  });

  it("falls back to envelopeFrom when both headers.from and reply_to are unusable", () => {
    const result = extractSenderEmail({
      headers: {},
      replyTo: null,
      envelopeFrom: "artist@example.com",
    });
    expect(result).toBe("artist@example.com");
  });

  it("handles capitalized 'From' header key", () => {
    const result = extractSenderEmail({
      headers: { From: "<sender@example.com>" },
      replyTo: null,
      envelopeFrom: "agent@mail.recoupable.com",
    });
    expect(result).toBe("sender@example.com");
  });

  it("ignores empty string headers.from and falls back", () => {
    const result = extractSenderEmail({
      headers: { from: "" },
      replyTo: ["fallback@example.com"],
      envelopeFrom: "agent@mail.recoupable.com",
    });
    expect(result).toBe("fallback@example.com");
  });
});
