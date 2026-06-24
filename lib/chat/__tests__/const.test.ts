import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "../const";

describe("SYSTEM_PROMPT", () => {
  it("no longer references the retired prompt_sandbox tool (chat#1813)", () => {
    expect(SYSTEM_PROMPT).not.toContain("prompt_sandbox");
    expect(SYSTEM_PROMPT).not.toContain("Sandbox-First");
  });

  it("retains the core agent framing", () => {
    expect(SYSTEM_PROMPT).toContain("You are Recoup");
    expect(SYSTEM_PROMPT).toContain("# Core Expertise");
  });
});
