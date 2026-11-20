import { describe, it, expect } from "vitest";
import { buildClaudeSandboxScript } from "@/lib/board/buildClaudeSandboxScript";

describe("buildClaudeSandboxScript", () => {
  const script = buildClaudeSandboxScript();

  it("installs vb and Claude Code without global installs", () => {
    expect(script).toContain("npm install --prefix");
    expect(script).toContain("@vercel/board@0.52.0");
    expect(script).toContain("@anthropic-ai/claude-code");
  });

  it("claims, renews and settles the task through vb tasks run", () => {
    expect(script).toContain('vb tasks run "$TASK_ID"');
  });

  it("limits Claude to vb commands", () => {
    expect(script).toContain('--allowedTools "Bash(vb:*)"');
  });

  it("reads the task id and prompt from the environment, not interpolated text", () => {
    expect(script).toContain('"$CLAUDE_PROMPT"');
    expect(script).not.toMatch(/\$\{[^}]*\}/);
  });
});
