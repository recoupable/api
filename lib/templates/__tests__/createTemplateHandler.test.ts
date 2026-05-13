import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/templates/validateCreateTemplateRequest", () => ({
  validateCreateTemplateRequest: vi.fn(),
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

const { createTemplateHandler } = await import("../createTemplateHandler");
const { validateCreateTemplateRequest } = await import(
  "@/lib/templates/validateCreateTemplateRequest"
);
const { insertAgentTemplate } = await import("@/lib/supabase/agent_templates/insertAgentTemplate");
const { insertAgentTemplateShares } = await import(
  "@/lib/supabase/agent_template_shares/insertAgentTemplateShares"
);
const { selectAgentTemplates } = await import(
  "@/lib/supabase/agent_templates/selectAgentTemplates"
);

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

const baseBody = {
  title: "Valid title",
  description: "valid description",
  prompt: "Valid prompt content for template",
  tags: [],
  is_private: false,
  share_emails: [],
};

const makeRequest = () =>
  new NextRequest("http://localhost/api/agents/templates", {
    method: "POST",
    headers: { "x-api-key": "k", "content-type": "application/json" },
    body: JSON.stringify(baseBody),
  });

describe("createTemplateHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a template and shares emails when private", async () => {
    vi.mocked(validateCreateTemplateRequest).mockResolvedValue({
      accountId: ACCOUNT_ID,
      body: { ...baseBody, is_private: true, share_emails: ["a@x.com"] },
    });
    vi.mocked(insertAgentTemplate).mockResolvedValue({ id: TEMPLATE_ID } as never);
    vi.mocked(insertAgentTemplateShares).mockResolvedValue(1);
    vi.mocked(selectAgentTemplates).mockResolvedValue([{ id: TEMPLATE_ID } as never]);

    const res = await createTemplateHandler(makeRequest());

    expect(res.status).toBe(201);
    expect((await res.json()).template.id).toBe(TEMPLATE_ID);
    expect(insertAgentTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ creator: ACCOUNT_ID, is_private: true }),
    );
    expect(insertAgentTemplateShares).toHaveBeenCalledWith(TEMPLATE_ID, ["a@x.com"]);
    expect(selectAgentTemplates).toHaveBeenCalledWith({ id: TEMPLATE_ID }, ACCOUNT_ID);
  });

  it("returns the validator error response when validation fails", async () => {
    const failure = NextResponse.json(
      { status: "error", error: "title must be at least 3 characters" },
      { status: 400 },
    );
    vi.mocked(validateCreateTemplateRequest).mockResolvedValue(failure);

    const res = await createTemplateHandler(makeRequest());
    expect(res).toBe(failure);
    expect(insertAgentTemplate).not.toHaveBeenCalled();
  });
});
