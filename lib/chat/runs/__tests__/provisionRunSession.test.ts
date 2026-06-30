import { describe, it, expect, vi, beforeEach } from "vitest";

import { provisionRunSession } from "../provisionRunSession";
import { createSessionWithInitialChat } from "@/lib/sessions/createSessionWithInitialChat";
import { connectSandbox } from "@/lib/sandbox/factory";
import { markSessionSandboxActive } from "@/lib/sandbox/markSessionSandboxActive";
import { discoverSkills } from "@/lib/skills/discoverSkills";
import { installSessionGlobalSkills } from "@/lib/sandbox/installSessionGlobalSkills";

vi.mock("@/lib/sessions/createSessionWithInitialChat", () => ({
  createSessionWithInitialChat: vi.fn(),
}));
vi.mock("@/lib/sandbox/factory", () => ({ connectSandbox: vi.fn() }));
vi.mock("@/lib/sandbox/getSessionSandboxName", () => ({
  getSessionSandboxName: vi.fn(() => "sandbox-name"),
}));
vi.mock("@/lib/sandbox/resolveGitUser", () => ({
  resolveGitUser: vi.fn(async () => ({ name: "x", email: "y" })),
}));
vi.mock("@/lib/github/getServiceGithubToken", () => ({
  getServiceGithubToken: vi.fn(() => "gh-token"),
}));
vi.mock("@/lib/sandbox/markSessionSandboxActive", () => ({
  markSessionSandboxActive: vi.fn(),
}));
vi.mock("@/lib/skills/discoverSkills", () => ({ discoverSkills: vi.fn() }));
vi.mock("@/lib/skills/getSandboxSkillDirectories", () => ({
  getSandboxSkillDirectories: vi.fn(async () => ["/skills"]),
}));
vi.mock("@/lib/sandbox/installSessionGlobalSkills", () => ({
  installSessionGlobalSkills: vi.fn(async () => undefined),
}));

const session = {
  id: "session-1",
  clone_url: "https://github.com/org/repo",
  sandbox_state: { type: "vercel" },
};
const updated = { ...session };
const chat = { id: "chat-1" };
const sandbox = {
  getState: () => ({ type: "vercel" }),
  workingDirectory: "/work",
};
const platformApiSkill = { name: "recoup-platform-api-access" };

describe("provisionRunSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSessionWithInitialChat).mockResolvedValue({
      ok: true,
      session,
      chat,
    } as never);
    vi.mocked(connectSandbox).mockResolvedValue(sandbox as never);
    vi.mocked(markSessionSandboxActive).mockResolvedValue(updated as never);
    // Default: the platform API-access skill is present after discovery.
    vi.mocked(discoverSkills).mockResolvedValue([platformApiSkill] as never);
  });

  it("installs global skills into the sandbox before discovering them", async () => {
    await provisionRunSession({ accountId: "account-1", title: "t" });

    // Headless runs must PROVISION skills, not just discover them (chat#1822).
    expect(installSessionGlobalSkills).toHaveBeenCalledWith({
      sessionRow: updated,
      sandbox,
    });

    const installOrder = vi.mocked(installSessionGlobalSkills).mock.invocationCallOrder[0];
    const discoverOrder = vi.mocked(discoverSkills).mock.invocationCallOrder[0];
    expect(installOrder).toBeLessThan(discoverOrder);
  });

  it("still completes the run when skill install fails but discovery finds the skill", async () => {
    vi.mocked(installSessionGlobalSkills).mockRejectedValueOnce(new Error("install boom"));

    const result = await provisionRunSession({ accountId: "account-1", title: "t" });

    expect(result.session).toEqual(updated);
    expect(discoverSkills).toHaveBeenCalled();
  });

  it("aborts the run when the platform API-access skill is missing after discovery", async () => {
    vi.mocked(discoverSkills).mockResolvedValue([] as never);

    // Fail closed: better a missed run than an ungrounded (fabricated) one (chat#1822).
    await expect(provisionRunSession({ accountId: "account-1", title: "t" })).rejects.toThrow(
      /recoup-platform-api-access/,
    );
  });
});
