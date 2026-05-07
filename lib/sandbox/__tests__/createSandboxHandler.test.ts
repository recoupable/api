import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { createSandboxHandler } from "@/lib/sandbox/createSandboxHandler";
import { validateCreateSandboxBody } from "@/lib/sandbox/validateCreateSandboxBody";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { connectSandbox } from "@/lib/sandbox/factory";
import { updateSession } from "@/lib/supabase/sessions/updateSession";
import { installSessionGlobalSkills } from "@/lib/sandbox/installSessionGlobalSkills";
import { findOrgSnapshot } from "@/lib/sandbox/findOrgSnapshot";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/sandbox/validateCreateSandboxBody", () => ({
  validateCreateSandboxBody: vi.fn(),
}));
vi.mock("@/lib/supabase/sessions/selectSessions", () => ({
  selectSessions: vi.fn(),
}));
vi.mock("@/lib/sandbox/factory", () => ({
  connectSandbox: vi.fn(),
}));
vi.mock("@/lib/supabase/sessions/updateSession", () => ({
  updateSession: vi.fn(),
}));
vi.mock("@/lib/github/getServiceGithubToken", () => ({
  getServiceGithubToken: vi.fn(() => "ghs_test_token"),
}));
vi.mock("@/lib/sandbox/installSessionGlobalSkills", () => ({
  installSessionGlobalSkills: vi.fn(async () => undefined),
}));
vi.mock("@/lib/sandbox/findOrgSnapshot", () => ({
  findOrgSnapshot: vi.fn(async () => null),
}));

const ACCOUNT_ID = "acc-1";

function makeReq(): NextRequest {
  return new NextRequest("http://localhost/api/sandbox", { method: "POST" });
}

function fakeSandbox(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    timeout: 1_800_000,
    expiresAt: Date.parse("2030-01-01T00:00:00.000Z"),
    currentBranch: "main",
    getState: () => ({ type: "vercel", sandboxName: "session-sess-1" }),
    ...overrides,
  };
}

describe("createSandboxHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCreateSandboxBody).mockResolvedValue({
      body: {
        repoUrl: "https://github.com/o/r",
        sessionId: "sess-1",
      },
      auth: { accountId: ACCOUNT_ID, orgId: null, authToken: "k" },
    });
    vi.mocked(selectSessions).mockResolvedValue([{ id: "sess-1", account_id: ACCOUNT_ID } as any]);
    vi.mocked(connectSandbox).mockResolvedValue(
      fakeSandbox() as unknown as Awaited<ReturnType<typeof connectSandbox>>,
    );
    vi.mocked(updateSession).mockResolvedValue({} as any);
  });

  it("short-circuits with the validator's response on validation failure", async () => {
    const fail = NextResponse.json({ status: "error", error: "bad" }, { status: 400 });
    vi.mocked(validateCreateSandboxBody).mockResolvedValueOnce(fail);

    const res = await createSandboxHandler(makeReq());

    expect(res).toBe(fail);
    expect(connectSandbox).not.toHaveBeenCalled();
  });

  it("returns 404 when sessionId is provided but the session does not exist", async () => {
    vi.mocked(selectSessions).mockResolvedValueOnce([]);

    const res = await createSandboxHandler(makeReq());

    expect(res.status).toBe(404);
    expect(connectSandbox).not.toHaveBeenCalled();
  });

  it("returns 403 when the session is not owned by the authenticated account", async () => {
    vi.mocked(selectSessions).mockResolvedValueOnce([
      { id: "sess-1", account_id: "someone-else" } as any,
    ]);

    const res = await createSandboxHandler(makeReq());

    expect(res.status).toBe(403);
    expect(connectSandbox).not.toHaveBeenCalled();
  });

  it("returns 502 when the sandbox provider throws", async () => {
    vi.mocked(connectSandbox).mockRejectedValueOnce(new Error("vercel down"));

    const res = await createSandboxHandler(makeReq());

    expect(res.status).toBe(502);
  });

  it("returns 200 with the documented response shape on success", async () => {
    const res = await createSandboxHandler(makeReq());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      timeout: 1_800_000,
      currentBranch: "main",
      mode: "vercel",
    });
    expect(typeof body.createdAt).toBe("number");
    expect(typeof body.timing.readyMs).toBe("number");
  });

  it("reports currentBranch from the sandbox handle (not request input)", async () => {
    vi.mocked(connectSandbox).mockResolvedValueOnce(
      fakeSandbox({ currentBranch: "release/v2" }) as unknown as Awaited<
        ReturnType<typeof connectSandbox>
      >,
    );

    const res = await createSandboxHandler(makeReq());

    const body = await res.json();
    expect(body.currentBranch).toBe("release/v2");
  });

  it("persists sandbox state and clears stale snapshot fields on the session row", async () => {
    await createSandboxHandler(makeReq());

    expect(updateSession).toHaveBeenCalledWith(
      "sess-1",
      expect.objectContaining({
        sandbox_state: { type: "vercel", sandboxName: "session-sess-1" },
        lifecycle_state: "active",
        snapshot_url: null,
        snapshot_created_at: null,
      }),
    );
  });

  it("plumbs the service github token into connectSandbox options", async () => {
    await createSandboxHandler(makeReq());

    const arg = vi.mocked(connectSandbox).mock.calls[0]?.[0];
    expect(arg).toBeDefined();
    if (!arg || !("options" in arg)) throw new Error("expected new-API config shape");
    expect(arg.options?.githubToken).toBe("ghs_test_token");
  });

  it("installs global skills into the freshly-provisioned sandbox", async () => {
    await createSandboxHandler(makeReq());

    expect(installSessionGlobalSkills).toHaveBeenCalledOnce();
    const call = vi.mocked(installSessionGlobalSkills).mock.calls[0][0];
    expect(call.sessionRow.id).toBe("sess-1");
  });

  it("returns 200 even when skill installation throws (best-effort)", async () => {
    vi.mocked(installSessionGlobalSkills).mockRejectedValueOnce(new Error("npx skills add failed"));

    const res = await createSandboxHandler(makeReq());

    expect(res.status).toBe(200);
  });

  it("looks up an org snapshot and plumbs its id into baseSnapshotId when the repo is a recoupable org repo", async () => {
    vi.mocked(validateCreateSandboxBody).mockResolvedValueOnce({
      body: {
        repoUrl: "https://github.com/recoupable/org-acme-xyz",
        sessionId: "sess-1",
      },
      auth: { accountId: ACCOUNT_ID, orgId: null, authToken: "k" },
    });
    vi.mocked(findOrgSnapshot).mockResolvedValueOnce("snap_abc123");

    await createSandboxHandler(makeReq());

    expect(findOrgSnapshot).toHaveBeenCalledWith("org-acme-xyz");
    const arg = vi.mocked(connectSandbox).mock.calls[0]?.[0];
    if (!arg || !("options" in arg)) throw new Error("expected new-API config shape");
    expect(arg.options?.baseSnapshotId).toBe("snap_abc123");
  });

  it("skips the snapshot lookup entirely for non-recoupable repos", async () => {
    vi.mocked(validateCreateSandboxBody).mockResolvedValueOnce({
      body: {
        repoUrl: "https://github.com/someoneelse/repo",
        sessionId: "sess-1",
      },
      auth: { accountId: ACCOUNT_ID, orgId: null, authToken: "k" },
    });

    await createSandboxHandler(makeReq());

    expect(findOrgSnapshot).not.toHaveBeenCalled();
    const arg = vi.mocked(connectSandbox).mock.calls[0]?.[0];
    if (!arg || !("options" in arg)) throw new Error("expected new-API config shape");
    expect(arg.options?.baseSnapshotId).toBeUndefined();
  });

  it("does not pass baseSnapshotId when the org snapshot lookup misses", async () => {
    vi.mocked(validateCreateSandboxBody).mockResolvedValueOnce({
      body: {
        repoUrl: "https://github.com/recoupable/org-no-snap-yet",
        sessionId: "sess-1",
      },
      auth: { accountId: ACCOUNT_ID, orgId: null, authToken: "k" },
    });
    vi.mocked(findOrgSnapshot).mockResolvedValueOnce(null);

    await createSandboxHandler(makeReq());

    expect(findOrgSnapshot).toHaveBeenCalledWith("org-no-snap-yet");
    const arg = vi.mocked(connectSandbox).mock.calls[0]?.[0];
    if (!arg || !("options" in arg)) throw new Error("expected new-API config shape");
    expect(arg.options?.baseSnapshotId).toBeUndefined();
  });

  it("does not attempt skill installation when no sessionId is provided", async () => {
    vi.mocked(validateCreateSandboxBody).mockResolvedValueOnce({
      body: { repoUrl: "https://github.com/o/r" },
      auth: { accountId: ACCOUNT_ID, orgId: null, authToken: "k" },
    });

    await createSandboxHandler(makeReq());

    expect(installSessionGlobalSkills).not.toHaveBeenCalled();
  });

  it("skips the session-row write when no sessionId is provided", async () => {
    vi.mocked(validateCreateSandboxBody).mockResolvedValueOnce({
      body: { repoUrl: "https://github.com/o/r" },
      auth: { accountId: ACCOUNT_ID, orgId: null, authToken: "k" },
    });

    const res = await createSandboxHandler(makeReq());

    expect(res.status).toBe(200);
    expect(updateSession).not.toHaveBeenCalled();
    expect(selectSessions).not.toHaveBeenCalled();
  });
});
