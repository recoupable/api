import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as readFile } from "@/app/api/sandboxes/file/route";
import { GET as listFiles } from "@/app/api/sandboxes/route";
import { RECOUP_ORG_ID } from "@/lib/const";

const mock = vi.hoisted(() => ({
  key: vi.fn(),
  token: vi.fn(),
  memberships: vi.fn(),
  shared: vi.fn(),
  snapshots: vi.fn(),
  sandboxes: vi.fn(),
  resolve: vi.fn(),
  raw: vi.fn(),
  versioned: vi.fn(),
  tree: vi.fn(),
}));
vi.mock("@/lib/auth/getAccountIdByApiKey", () => ({ getAccountIdByApiKey: mock.key }));
vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: mock.token,
}));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: mock.memberships,
}));
vi.mock("@/lib/supabase/account_organization_ids/selectAccountOrganizationIds", () => ({
  selectAccountOrganizationIds: mock.shared,
}));
vi.mock("@/lib/supabase/account_snapshots/selectAccountSnapshots", () => ({
  selectAccountSnapshots: mock.snapshots,
}));
vi.mock("@/lib/supabase/account_sandboxes/selectAccountSandboxes", () => ({
  selectAccountSandboxes: mock.sandboxes,
}));
vi.mock("@/lib/github/resolveSubmodulePath", () => ({ resolveSubmodulePath: mock.resolve }));
vi.mock("@/lib/github/getRawFileContent", () => ({ getRawFileContent: mock.raw }));
vi.mock("@/lib/github/getVersionedFileContent", () => ({
  getVersionedFileContent: mock.versioned,
}));
vi.mock("@/lib/github/getRepoFileTree", () => ({ getRepoFileTree: mock.tree }));
vi.mock("@/lib/sandbox/getSandboxStatus", () => ({ getSandboxStatus: vi.fn() }));
vi.mock("@/lib/sandbox/createSandboxPostHandler", () => ({ createSandboxPostHandler: vi.fn() }));
vi.mock("@/lib/sandbox/deleteSandboxHandler", () => ({ deleteSandboxHandler: vi.fn() }));
vi.mock("@/lib/sandbox/updateSnapshotPatchHandler", () => ({
  updateSnapshotPatchHandler: vi.fn(),
}));

const caller = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";
const org = "33333333-3333-4333-8333-333333333333";
const sha = "a".repeat(40);
const bearer = { authorization: "Bearer synthetic-privy-token" };
const apiKey = { "x-api-key": "recoup_sk_synthetic" };
const repo = (account: string) => `https://github.com/example/${account}`;
const invoke = (
  kind: "file" | "list",
  query: Record<string, string> = {},
  headers: Record<string, string> = bearer,
) => {
  const params = new URLSearchParams(kind === "file" ? { path: "draft.txt", ...query } : query);
  return (kind === "file" ? readFile : listFiles)(
    new NextRequest(
      `https://api.example/api/sandboxes${kind === "file" ? "/file" : ""}?${params}`,
      {
        headers,
      },
    ),
  );
};
const expectNoRepositoryAccess = () => {
  for (const leaf of [
    mock.snapshots,
    mock.sandboxes,
    mock.resolve,
    mock.raw,
    mock.versioned,
    mock.tree,
  ]) {
    expect(leaf).not.toHaveBeenCalled();
  }
};

beforeEach(() => {
  vi.resetAllMocks();
  mock.key.mockResolvedValue(caller);
  mock.token.mockResolvedValue(caller);
  mock.memberships.mockResolvedValue([{ organization_id: org }]);
  mock.shared.mockResolvedValue([{ account_id: target, organization_id: org }]);
  mock.snapshots.mockImplementation(async account => [
    { github_repo: repo(account), snapshot_id: account },
  ]);
  mock.sandboxes.mockResolvedValue([]);
  mock.resolve.mockImplementation(async input => input);
  mock.raw.mockResolvedValue({ content: "selected file" });
  mock.versioned.mockResolvedValue({ content: "selected revision", sha });
  mock.tree.mockResolvedValue([{ name: "draft.txt", type: "file" }]);
});

describe.each(["file", "list"] as const)("account-scoped %s GET route", kind => {
  it.each([bearer, apiKey, { authorization: "Bearer recoup_sk_synthetic" }])(
    "reads and acknowledges only the authorized target with %j",
    async headers => {
      const response = await invoke(kind, { account_id: target }, headers);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: "success", account_id: target });
      expect(mock.memberships).toHaveBeenCalledWith({ accountId: caller });
      expect(mock.shared).toHaveBeenCalledWith(target, [org]);
      expect(mock.snapshots).toHaveBeenCalledExactlyOnceWith(target);
      if (kind === "file")
        expect(mock.resolve).toHaveBeenCalledWith({ githubRepo: repo(target), path: "draft.txt" });
      else {
        expect(mock.sandboxes).toHaveBeenCalledWith({ accountIds: [target], sandboxId: undefined });
        expect(mock.tree).toHaveBeenCalledWith(repo(target));
      }
    },
  );

  it("keeps the authenticated-account legacy response unchanged", async () => {
    const response = await invoke(kind);
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty("account_id");
    expect(mock.snapshots).toHaveBeenCalledExactlyOnceWith(caller);
    expect(mock.memberships).not.toHaveBeenCalled();
  });

  it("accepts an explicit self target without requiring organization membership", async () => {
    mock.memberships.mockResolvedValue([]);
    const response = await invoke(kind, { account_id: caller });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ account_id: caller });
    expect(mock.memberships).not.toHaveBeenCalled();
  });

  it.each([{ shared: [] }, { shared: null }])(
    "denies missing shared membership (%j) before repository access",
    async ({ shared }) => {
      mock.shared.mockResolvedValue(shared);
      const response = await invoke(kind, { account_id: target });
      expect(response.status).toBe(403);
      expectNoRepositoryAccess();
    },
  );

  it("denies a caller without organizations before repository access", async () => {
    mock.memberships.mockResolvedValue([]);
    expect((await invoke(kind, { account_id: target })).status).toBe(403);
    expectNoRepositoryAccess();
  });

  it.each([org, RECOUP_ORG_ID])(
    "retains the existing organization/admin rule %s",
    async membership => {
      mock.memberships.mockResolvedValue([{ organization_id: membership }]);
      const response = await invoke(kind, { account_id: membership === org ? org : target });
      expect(response.status).toBe(200);
      expect(await response.json()).toHaveProperty("account_id", membership === org ? org : target);
      expect(mock.shared).not.toHaveBeenCalled();
    },
  );

  it.each(["", "not-a-uuid"])(
    "rejects malformed targets %j before auth/provider lookup",
    async account_id => {
      expect((await invoke(kind, { account_id })).status).toBe(400);
      expect(mock.key).not.toHaveBeenCalled();
      expect(mock.token).not.toHaveBeenCalled();
      expectNoRepositoryAccess();
    },
  );

  it.each([{}, { ...bearer, ...apiKey }])(
    "rejects missing/conflicting authentication %j",
    async headers => {
      expect((await invoke(kind, { account_id: target }, headers)).status).toBe(401);
      expectNoRepositoryAccess();
    },
  );

  it("rejects an invalid API key before target lookup", async () => {
    mock.key.mockResolvedValue(null);
    expect((await invoke(kind, { account_id: target }, apiKey)).status).toBe(401);
    expect(mock.memberships).not.toHaveBeenCalled();
    expectNoRepositoryAccess();
  });
});

it("pairs selected-account content and SHA without falling back to a raw read", async () => {
  const response = await invoke("file", { account_id: target, include_revision: "true" });
  expect(await response.json()).toEqual({
    status: "success",
    account_id: target,
    content: "selected revision",
    sha,
  });
  expect(mock.versioned).toHaveBeenCalledWith({
    githubRepo: repo(target),
    path: "draft.txt",
    format: undefined,
  });
  expect(mock.raw).not.toHaveBeenCalled();
});

it("preserves binary encoding with the selected account", async () => {
  mock.raw.mockResolvedValue({ content: "aGVsbG8=", encoding: "base64" });
  const response = await invoke("file", { account_id: target, path: "image.png" });
  expect(await response.json()).toMatchObject({
    account_id: target,
    encoding: "base64",
    content: "aGVsbG8=",
  });
  expect(mock.raw).toHaveBeenCalledWith({
    githubRepo: repo(target),
    path: "image.png",
    format: "base64",
  });
});

it("never falls back to the caller repository when the selected account has none", async () => {
  mock.snapshots.mockResolvedValue([]);
  expect((await invoke("file", { account_id: target })).status).toBe(404);
  expect(mock.snapshots).toHaveBeenCalledExactlyOnceWith(target);
  expect(mock.raw).not.toHaveBeenCalled();
});

it.each(["../secret", "draft//notes.txt", "\\secret"])(
  "retains canonical path rejection: %s",
  async path => {
    expect((await invoke("file", { account_id: target, path })).status).toBe(400);
    expectNoRepositoryAccess();
  },
);
