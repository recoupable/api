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

vi.mock("@/lib/supabase/agent_template_favorites/selectAgentTemplateFavorites", () => ({
  selectAgentTemplateFavorites: vi.fn(),
}));

vi.mock("@/lib/agent_templates/resolveSharedEmailsByTemplateId", () => ({
  resolveSharedEmailsByTemplateId: vi.fn(),
}));

const { listAgentTemplatesHandler } = await import("../listAgentTemplatesHandler");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { selectAgentTemplates } = await import(
  "@/lib/supabase/agent_templates/selectAgentTemplates"
);
const { selectAgentTemplateFavorites } = await import(
  "@/lib/supabase/agent_template_favorites/selectAgentTemplateFavorites"
);
const { resolveSharedEmailsByTemplateId } = await import(
  "@/lib/agent_templates/resolveSharedEmailsByTemplateId"
);

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";

describe("listAgentTemplatesHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns shaped templates with is_favourite + shared_emails for the authenticated account", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_ID,
      orgId: null,
      authToken: "k",
    });
    vi.mocked(selectAgentTemplates).mockResolvedValue([
      {
        id: "t1",
        title: "Public",
        description: "",
        prompt: "",
        tags: [],
        is_private: false,
        favorites_count: 0,
        created_at: "2026-01-01",
        updated_at: null,
        creator: { id: "other", name: null, account_info: [], account_emails: [] },
      } as never,
      {
        id: "t2",
        title: "Mine",
        description: "",
        prompt: "",
        tags: [],
        is_private: true,
        favorites_count: 0,
        created_at: "2026-01-01",
        updated_at: null,
        creator: { id: ACCOUNT_ID, name: null, account_info: [], account_emails: [] },
      } as never,
    ]);
    vi.mocked(selectAgentTemplateFavorites).mockResolvedValue([
      { template_id: "t1", user_id: ACCOUNT_ID, created_at: null },
    ]);
    vi.mocked(resolveSharedEmailsByTemplateId).mockResolvedValue({ t2: ["a@x.com"] });

    const res = await listAgentTemplatesHandler(
      new NextRequest("http://localhost/api/agent-templates", { headers: { "x-api-key": "k" } }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toHaveLength(2);
    expect(body.templates[0].is_favourite).toBe(true);
    expect(body.templates[0].shared_emails).toEqual([]);
    expect(body.templates[1].is_favourite).toBe(false);
    expect(body.templates[1].shared_emails).toEqual(["a@x.com"]);
    expect(selectAgentTemplates).toHaveBeenCalledWith({ accessibleTo: ACCOUNT_ID });
    expect(resolveSharedEmailsByTemplateId).toHaveBeenCalledWith(["t2"]);
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
