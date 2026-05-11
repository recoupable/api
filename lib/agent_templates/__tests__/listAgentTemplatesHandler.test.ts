import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/agent_templates/getAccessibleAgentTemplatesForAccount", () => ({
  getAccessibleAgentTemplatesForAccount: vi.fn(),
}));

const { listAgentTemplatesHandler } = await import("../listAgentTemplatesHandler");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { getAccessibleAgentTemplatesForAccount } = await import(
  "@/lib/agent_templates/getAccessibleAgentTemplatesForAccount"
);

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";

describe("listAgentTemplatesHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns templates for the authenticated account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_ID,
      orgId: null,
      authToken: "k",
    });
    vi.mocked(getAccessibleAgentTemplatesForAccount).mockResolvedValue([
      { id: "t1", title: "T", shared_emails: [] } as never,
    ]);

    const res = await listAgentTemplatesHandler(
      new NextRequest("http://localhost/api/agent-templates", { headers: { "x-api-key": "k" } }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).templates).toHaveLength(1);
    expect(getAccessibleAgentTemplatesForAccount).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it("returns the auth NextResponse when authentication fails", async () => {
    const failure = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);

    const res = await listAgentTemplatesHandler(
      new NextRequest("http://localhost/api/agent-templates"),
    );

    expect(res).toBe(failure);
    expect(getAccessibleAgentTemplatesForAccount).not.toHaveBeenCalled();
  });
});
