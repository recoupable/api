import { describe, it, expect } from "vitest";
import { readHeader } from "../readHeader";

describe("readHeader", () => {
  it("returns the value for an exact-case match", () => {
    expect(readHeader({ from: "a@example.com" }, "from")).toBe("a@example.com");
  });

  it("returns the value for a capitalized key", () => {
    expect(readHeader({ From: "a@example.com" }, "from")).toBe("a@example.com");
  });

  it("returns the value for a mixed-case key", () => {
    expect(readHeader({ "Reply-To": "a@example.com" }, "reply-to")).toBe("a@example.com");
  });

  it("returns undefined when the header is missing", () => {
    expect(readHeader({ subject: "Hi" }, "from")).toBeUndefined();
  });

  it("returns undefined for an empty headers object", () => {
    expect(readHeader({}, "from")).toBeUndefined();
  });
});
