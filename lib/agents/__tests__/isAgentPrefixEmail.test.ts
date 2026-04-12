import { describe, it, expect } from "vitest";
import { isAgentPrefixEmail } from "@/lib/agents/isAgentPrefixEmail";

describe("isAgentPrefixEmail", () => {
  it("returns true for agent+ prefix email", () => {
    expect(isAgentPrefixEmail("agent+mybot@example.com")).toBe(true);
  });

  it("returns true for uppercase agent+ prefix", () => {
    expect(isAgentPrefixEmail("Agent+MyBot@example.com")).toBe(true);
  });

  it("returns false for normal email", () => {
    expect(isAgentPrefixEmail("user@example.com")).toBe(false);
  });

  it("returns false for email containing agent but not as prefix", () => {
    expect(isAgentPrefixEmail("my-agent@example.com")).toBe(false);
  });
});
