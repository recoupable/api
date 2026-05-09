import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_templates/getAccessibleAgentTemplates", () => ({
  getAccessibleAgentTemplates: vi.fn(),
}));

const { listAgentTemplatesHandler } = await import("../listAgentTemplatesHandler");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { getAccessibleAgentTemplates } = await import(
  "@/lib/supabase/agent_templates/getAccessibleAgentTemplates"
);

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";

describe("listAgentTemplatesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns templates for the authenticated account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_ID,
      orgId: null,
      authToken: "k",
    });
    vi.mocked(getAccessibleAgentTemplates).mockResolvedValue([
      // Cast to match the enriched shape we expect downstream.

      { id: "t1", title: "T", shared_emails: [] } as any,
    ]);

    const req = new NextRequest("http://localhost/api/agent-templates", {
      headers: { "x-api-key": "k" },
    });
    const res = await listAgentTemplatesHandler(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.templates).toHaveLength(1);
    expect(getAccessibleAgentTemplates).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it("returns the auth NextResponse when authentication fails", async () => {
    const failure = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);

    const req = new NextRequest("http://localhost/api/agent-templates");
    const res = await listAgentTemplatesHandler(req);

    expect(res).toBe(failure);
    expect(getAccessibleAgentTemplates).not.toHaveBeenCalled();
  });
});
