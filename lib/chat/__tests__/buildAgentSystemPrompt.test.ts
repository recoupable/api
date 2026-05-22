import { describe, it, expect } from "vitest";
import { buildAgentSystemPrompt } from "@/lib/chat/buildAgentSystemPrompt";

describe("buildAgentSystemPrompt", () => {
  it("emits only customInstructions when no cwd/branch is provided", () => {
    const prompt = buildAgentSystemPrompt({ customInstructions: "hello" });
    expect(prompt).toContain("hello");
    expect(prompt).not.toMatch(/Working directory/);
    expect(prompt).not.toMatch(/Current branch/);
  });

  it("includes an Environment section when cwd is provided", () => {
    const prompt = buildAgentSystemPrompt({ cwd: "/vercel/sandbox" });
    expect(prompt).toMatch(/# Environment/);
    expect(prompt).toMatch(/Working directory: \. \(workspace root\)/);
    expect(prompt).toMatch(/workspace-relative paths/);
  });

  it("includes Current branch + cloud sandbox checkpointing when currentBranch is provided", () => {
    const prompt = buildAgentSystemPrompt({
      cwd: "/sandbox",
      currentBranch: "feat/foo",
    });
    expect(prompt).toMatch(/Current branch: feat\/foo/);
    expect(prompt).toMatch(/# Cloud Sandbox/);
    expect(prompt).toMatch(/git push -u origin feat\/foo/);
  });

  it("omits cloud sandbox checkpointing when no currentBranch", () => {
    const prompt = buildAgentSystemPrompt({ cwd: "/sandbox" });
    expect(prompt).not.toMatch(/# Cloud Sandbox/);
    expect(prompt).not.toMatch(/Current branch/);
  });

  it("appends customInstructions AFTER the environment + branch sections", () => {
    const prompt = buildAgentSystemPrompt({
      cwd: "/sandbox",
      currentBranch: "main",
      customInstructions: "MARK_AT_END",
    });
    const envIdx = prompt.indexOf("# Environment");
    const branchIdx = prompt.indexOf("Current branch");
    const cloudIdx = prompt.indexOf("# Cloud Sandbox");
    const customIdx = prompt.indexOf("MARK_AT_END");
    expect(envIdx).toBeGreaterThanOrEqual(0);
    expect(branchIdx).toBeGreaterThan(envIdx);
    expect(cloudIdx).toBeGreaterThan(branchIdx);
    expect(customIdx).toBeGreaterThan(cloudIdx);
  });

  it("returns empty string when all options are empty", () => {
    expect(buildAgentSystemPrompt({})).toBe("");
  });
});
