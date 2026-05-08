import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { validateCreateSandboxBody } from "@/lib/sandbox/validateCreateSandboxBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const ACCOUNT_ID = "acc-1";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/sandbox", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "k" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("validateCreateSandboxBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_ID,
      orgId: null,
      authToken: "k",
    });
  });

  it("returns the auth response unchanged when auth fails", async () => {
    const failure = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValueOnce(failure);

    const result = await validateCreateSandboxBody(makeReq({ repoUrl: "x" }));

    expect(result).toBe(failure);
  });

  it("returns 400 when repoUrl is missing", async () => {
    const result = await validateCreateSandboxBody(makeReq({}));

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.status).toBe("error");
    expect(json.missing_fields).toEqual(["repoUrl"]);
  });

  it("returns 400 when repoUrl is empty", async () => {
    const result = await validateCreateSandboxBody(makeReq({ repoUrl: "" }));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when JSON body is malformed", async () => {
    const result = await validateCreateSandboxBody(makeReq("not-json"));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when repoUrl is not a valid GitHub repository URL", async () => {
    const result = await validateCreateSandboxBody(makeReq({ repoUrl: "https://gitlab.com/o/r" }));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns 400 when repoUrl is not a URL at all", async () => {
    const result = await validateCreateSandboxBody(makeReq({ repoUrl: "x" }));

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns the validated body + auth on a minimal happy path", async () => {
    const result = await validateCreateSandboxBody(makeReq({ repoUrl: "https://github.com/o/r" }));

    expect(result).not.toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) return;
    expect(result.body.repoUrl).toBe("https://github.com/o/r");
    expect(result.body.sessionId).toBeUndefined();
    expect(result.auth.accountId).toBe(ACCOUNT_ID);
  });

  it("accepts a request with sessionId", async () => {
    const result = await validateCreateSandboxBody(
      makeReq({
        repoUrl: "https://github.com/o/r",
        sessionId: "sess-1",
      }),
    );

    expect(result).not.toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) return;
    expect(result.body.sessionId).toBe("sess-1");
  });

  it("preserves `branch` and `isNewBranch` on the validated body", async () => {
    const result = await validateCreateSandboxBody(
      makeReq({
        repoUrl: "https://github.com/o/r",
        branch: "feat/x",
        isNewBranch: true,
      }),
    );

    expect(result).not.toBeInstanceOf(NextResponse);
    if (result instanceof NextResponse) return;
    expect(result.body.branch).toBe("feat/x");
    expect(result.body.isNewBranch).toBe(true);
  });

  it("rejects a non-boolean isNewBranch", async () => {
    const result = await validateCreateSandboxBody(
      makeReq({
        repoUrl: "https://github.com/o/r",
        isNewBranch: "yes",
      }),
    );

    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) return;
    expect(result.status).toBe(400);
  });
});
