import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { createSandboxHandler } from "@/lib/sandbox/createSandboxHandler";
import { validateCreateSandboxBody } from "@/lib/sandbox/validateCreateSandboxBody";
import { selectSessions } from "@/lib/supabase/sessions/selectSessions";
import { connectSandbox } from "@/lib/sandbox/factory";
import { updateSessionSandboxState } from "@/lib/supabase/sessions/updateSessionSandboxState";

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
vi.mock("@/lib/supabase/sessions/updateSessionSandboxState", () => ({
  updateSessionSandboxState: vi.fn(),
}));

const ACCOUNT_ID = "acc-1";

function makeReq(): NextRequest {
  return new NextRequest("http://localhost/api/sandbox", { method: "POST" });
}

function fakeSandbox(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    timeout: 1_800_000,
    expiresAt: Date.parse("2030-01-01T00:00:00.000Z"),
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
        branch: "main",
      },
      auth: { accountId: ACCOUNT_ID, orgId: null, authToken: "k" },
    });
    vi.mocked(selectSessions).mockResolvedValue([{ id: "sess-1", account_id: ACCOUNT_ID } as any]);
    vi.mocked(connectSandbox).mockResolvedValue(
      fakeSandbox() as unknown as Awaited<ReturnType<typeof connectSandbox>>,
    );
    vi.mocked(updateSessionSandboxState).mockResolvedValue({} as any);
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

  it("persists sandbox state to the session row when sessionId is provided", async () => {
    await createSandboxHandler(makeReq());

    expect(updateSessionSandboxState).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sess-1",
        sandboxState: { type: "vercel", sandboxName: "session-sess-1" },
      }),
    );
  });

  it("skips the session-row write when no sessionId is provided", async () => {
    vi.mocked(validateCreateSandboxBody).mockResolvedValueOnce({
      body: { repoUrl: "https://github.com/o/r", branch: "main" },
      auth: { accountId: ACCOUNT_ID, orgId: null, authToken: "k" },
    });

    const res = await createSandboxHandler(makeReq());

    expect(res.status).toBe(200);
    expect(updateSessionSandboxState).not.toHaveBeenCalled();
    expect(selectSessions).not.toHaveBeenCalled();
  });

  it("uses isNewBranch=true to flip source.branch into source.newBranch", async () => {
    vi.mocked(validateCreateSandboxBody).mockResolvedValueOnce({
      body: {
        repoUrl: "https://github.com/o/r",
        sessionId: "sess-1",
        branch: "feat/x",
        isNewBranch: true,
      },
      auth: { accountId: ACCOUNT_ID, orgId: null, authToken: "k" },
    });

    await createSandboxHandler(makeReq());

    const arg = vi.mocked(connectSandbox).mock.calls[0]?.[0];
    expect(arg).toBeDefined();
    if (!arg || !("state" in arg)) throw new Error("expected new-API config shape");

    const source = (arg.state as any).source;
    expect(source.newBranch).toBe("feat/x");
    expect(source.branch).toBeUndefined();
  });
});
