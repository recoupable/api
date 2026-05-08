import { describe, it, expect, vi, beforeEach } from "vitest";
import { installSessionGlobalSkills } from "@/lib/sandbox/installSessionGlobalSkills";
import { installGlobalSkills } from "@/lib/skills/installGlobalSkills";
import { DEFAULT_GLOBAL_SKILL_REFS } from "@/lib/skills/defaultGlobalSkillRefs";
import type { Tables } from "@/types/database.types";

vi.mock("@/lib/skills/installGlobalSkills", () => ({
  installGlobalSkills: vi.fn(async () => undefined),
}));

const sandbox = { workingDirectory: "/workspace", exec: vi.fn() } as never;

// Tests only read `id` and `global_skill_refs`; everything else gets cast
// past TS so the fixture stays small.
const baseRow = {
  id: "sess-1",
  global_skill_refs: null as unknown,
} as unknown as Tables<"sessions">;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("installSessionGlobalSkills", () => {
  it("installs only the platform defaults when the row has no user refs", async () => {
    await installSessionGlobalSkills({ sessionRow: baseRow, sandbox });

    expect(installGlobalSkills).toHaveBeenCalledOnce();
    const { globalSkillRefs } = vi.mocked(installGlobalSkills).mock.calls[0][0];
    expect(globalSkillRefs).toEqual([...DEFAULT_GLOBAL_SKILL_REFS]);
  });

  it("merges the platform defaults with normalized user refs", async () => {
    const row = {
      ...baseRow,
      global_skill_refs: [{ source: "user/repo", skillName: "custom-skill" }],
    } as never;

    await installSessionGlobalSkills({ sessionRow: row, sandbox });

    const { globalSkillRefs } = vi.mocked(installGlobalSkills).mock.calls[0][0];
    expect(globalSkillRefs).toEqual([
      ...DEFAULT_GLOBAL_SKILL_REFS,
      { source: "user/repo", skillName: "custom-skill" },
    ]);
  });

  // Behavior matches open-agents: if any user ref fails validation, ALL user
  // refs are dropped (the schema rejects the whole array), and we install only
  // the platform defaults. Strict on purpose — partial-acceptance would let a
  // typo in one ref silently swallow others.
  it("drops every user ref when any fail validation", async () => {
    const row = {
      ...baseRow,
      global_skill_refs: [{ bad: "shape" }, { source: "good/repo", skillName: "ok" }],
    } as never;

    await installSessionGlobalSkills({ sessionRow: row, sandbox });

    const { globalSkillRefs } = vi.mocked(installGlobalSkills).mock.calls[0][0];
    expect(globalSkillRefs).toEqual([...DEFAULT_GLOBAL_SKILL_REFS]);
  });
});
