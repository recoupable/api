import { describe, it, expect } from "vitest";
import { buildAgentSystemPrompt } from "@/lib/chat/buildAgentSystemPrompt";

describe("buildAgentSystemPrompt", () => {
  it("emits only customInstructions when no cwd is provided", () => {
    const prompt = buildAgentSystemPrompt({ customInstructions: "hello" });
    expect(prompt).toContain("hello");
    expect(prompt).not.toMatch(/Working directory/);
  });

  it("includes an Environment section when cwd is provided", () => {
    const prompt = buildAgentSystemPrompt({ cwd: "/vercel/sandbox" });
    expect(prompt).toMatch(/# Environment/);
    expect(prompt).toMatch(/Working directory: \. \(workspace root\)/);
    expect(prompt).toMatch(/workspace-relative paths/);
  });

  it("appends customInstructions AFTER the environment section", () => {
    const prompt = buildAgentSystemPrompt({
      cwd: "/sandbox",
      customInstructions: "MARK_AT_END",
    });
    const envIdx = prompt.indexOf("# Environment");
    const customIdx = prompt.indexOf("MARK_AT_END");
    expect(envIdx).toBeGreaterThanOrEqual(0);
    expect(customIdx).toBeGreaterThan(envIdx);
  });

  it("always includes the data-grounding no-fabrication rule, even with empty options", () => {
    const prompt = buildAgentSystemPrompt({});
    expect(prompt).toMatch(/never fabricate/i);
    expect(prompt).toMatch(/sample|estimate|industry average/i);
  });
});
