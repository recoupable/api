import { describe, it, expect } from "vitest";
import { buildClaudeTaskPrompt } from "@/lib/board/buildClaudeTaskPrompt";

describe("buildClaudeTaskPrompt", () => {
  const prompt = buildClaudeTaskPrompt({ id: "812", channel: "general" });

  it("names the task and its channel", () => {
    expect(prompt).toContain("#812");
    expect(prompt).toContain("general");
  });

  it("tells Claude to read the task and reply in its thread", () => {
    expect(prompt).toContain("vb read 812");
    expect(prompt).toContain("vb reply 812");
  });

  it("does not include the task text itself", () => {
    expect(prompt).not.toContain("today's date");
  });
});
