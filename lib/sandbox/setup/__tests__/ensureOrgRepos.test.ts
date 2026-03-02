import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Sandbox } from "@vercel/sandbox";

import { ensureOrgRepos } from "../ensureOrgRepos";
import type { SetupDeps } from "../types";

const mockGetAccountOrganizations = vi.fn();
const mockCreateOrgGithubRepo = vi.fn();

vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: (...args: unknown[]) => mockGetAccountOrganizations(...args),
}));

vi.mock("@/lib/github/createOrgGithubRepo", () => ({
  createOrgGithubRepo: (...args: unknown[]) => mockCreateOrgGithubRepo(...args),
}));

vi.mock("../helpers", () => ({
  runOpenClawAgent: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
}));

describe("ensureOrgRepos", () => {
  const mockRunCommand = vi.fn();
  const mockSandbox = {
    sandboxId: "sbx_123",
    runCommand: mockRunCommand,
  } as unknown as Sandbox;
  const deps: SetupDeps = {
    log: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GITHUB_TOKEN", "test-token");
  });

  it("returns early when GITHUB_TOKEN missing", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    delete process.env.GITHUB_TOKEN;

    await ensureOrgRepos(mockSandbox, "acc_1", deps);

    expect(mockGetAccountOrganizations).not.toHaveBeenCalled();
  });

  it("returns early when no orgs found", async () => {
    mockGetAccountOrganizations.mockResolvedValue([]);

    await ensureOrgRepos(mockSandbox, "acc_1", deps);

    expect(mockCreateOrgGithubRepo).not.toHaveBeenCalled();
  });

  it("creates repos for each org", async () => {
    mockGetAccountOrganizations.mockResolvedValue([
      {
        account_id: "acc_1",
        organization_id: "org_1",
        organization: { id: "org_1", name: "My Org" },
      },
    ]);
    mockCreateOrgGithubRepo.mockResolvedValue("https://github.com/recoupable/org-my-org-org_1");

    await ensureOrgRepos(mockSandbox, "acc_1", deps);

    expect(mockCreateOrgGithubRepo).toHaveBeenCalledWith("My Org", "org_1");
  });
});
