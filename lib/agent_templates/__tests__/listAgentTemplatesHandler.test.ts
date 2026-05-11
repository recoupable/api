import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_templates/selectAgentTemplates", () => ({
  selectAgentTemplates: vi.fn(),
}));

const { listAgentTemplatesHandler } = await import("../listAgentTemplatesHandler");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { selectAgentTemplates } = await import(
  "@/lib/supabase/agent_templates/selectAgentTemplates"
);

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";

describe("listAgentTemplatesHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns templates fetched via selectAgentTemplates for the authenticated account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_ID,
      orgId: null,
      authToken: "k",
    });
    vi.mocked(selectAgentTemplates).mockResolvedValue([
      { id: "t1", is_favourite: true, shared_emails: [] } as never,
    ]);

    const res = await listAgentTemplatesHandler(
      new NextRequest("http://localhost/api/agent-templates", { headers: { "x-api-key": "k" } }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).templates).toHaveLength(1);
    expect(selectAgentTemplates).toHaveBeenCalledWith({ accessibleTo: ACCOUNT_ID }, ACCOUNT_ID);
  });

  it("returns the auth NextResponse when authentication fails", async () => {
    const failure = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);

    const res = await listAgentTemplatesHandler(
      new NextRequest("http://localhost/api/agent-templates"),
    );

    expect(res).toBe(failure);
    expect(selectAgentTemplates).not.toHaveBeenCalled();
  });
});
