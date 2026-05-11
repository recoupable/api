import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_templates/insertAgentTemplate", () => ({
  insertAgentTemplate: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_template_shares/insertAgentTemplateShares", () => ({
  insertAgentTemplateShares: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_templates/selectAgentTemplates", () => ({
  selectAgentTemplates: vi.fn(),
}));

const { createAgentTemplateHandler } = await import("../createAgentTemplateHandler");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { insertAgentTemplate } = await import("@/lib/supabase/agent_templates/insertAgentTemplate");
const { insertAgentTemplateShares } = await import(
  "@/lib/supabase/agent_template_shares/insertAgentTemplateShares"
);
const { selectAgentTemplates } = await import(
  "@/lib/supabase/agent_templates/selectAgentTemplates"
);

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

const mockAuthOk = () =>
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: ACCOUNT_ID,
    orgId: null,
    authToken: "k",
  });

const makeRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/agent-templates", {
    method: "POST",
    headers: { "x-api-key": "k", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  title: "Valid title",
  description: "valid description",
  prompt: "Valid prompt content for template",
  tags: [],
  is_private: false,
  share_emails: [],
};

describe("createAgentTemplateHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a template and shares emails when private", async () => {
    mockAuthOk();
    vi.mocked(insertAgentTemplate).mockResolvedValue({ id: TEMPLATE_ID } as never);
    vi.mocked(insertAgentTemplateShares).mockResolvedValue(1);
    vi.mocked(selectAgentTemplates).mockResolvedValue([{ id: TEMPLATE_ID } as never]);

    const res = await createAgentTemplateHandler(
      makeRequest({ ...validBody, is_private: true, share_emails: ["a@x.com"] }),
    );

    expect(res.status).toBe(201);
    expect((await res.json()).template.id).toBe(TEMPLATE_ID);
    expect(insertAgentTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ creator: ACCOUNT_ID, is_private: true }),
    );
    expect(insertAgentTemplateShares).toHaveBeenCalledWith(TEMPLATE_ID, ["a@x.com"]);
    expect(selectAgentTemplates).toHaveBeenCalledWith({ id: TEMPLATE_ID }, ACCOUNT_ID);
  });

  it("returns 400 when validation fails", async () => {
    mockAuthOk();
    const res = await createAgentTemplateHandler(makeRequest({ title: "no" }));
    expect(res.status).toBe(400);
    expect(insertAgentTemplate).not.toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    const failure = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);
    const res = await createAgentTemplateHandler(makeRequest(validBody));
    expect(res).toBe(failure);
  });
});
