import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "../const";

describe("SYSTEM_PROMPT", () => {
  describe("release routing", () => {
    it("includes release management in prompt_sandbox bullet points", () => {
      expect(SYSTEM_PROMPT).toContain(
        "**All release management** — creating releases, updating release info, checking release status, adding tracks, DSP pitches, marketing plans",
      );
    });

    it("explicitly warns against using create_knowledge_base for releases", () => {
      expect(SYSTEM_PROMPT).toContain(
        "Do NOT use create_knowledge_base for release information, track listings, or release plans",
      );
    });

    it("directs release-related tasks to prompt_sandbox", () => {
      expect(SYSTEM_PROMPT).toContain("always use prompt_sandbox for anything release-related");
    });
  });
});
