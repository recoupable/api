import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/templates/validateUpdateTemplateRequest", () => ({
  validateUpdateTemplateRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_templates/updateAgentTemplate", () => ({
  updateAgentTemplate: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_template_shares/deleteAgentTemplateShares", () => ({
  deleteAgentTemplateShares: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_template_shares/insertAgentTemplateShares", () => ({
  insertAgentTemplateShares: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_templates/selectAgentTemplates", () => ({
  selectAgentTemplates: vi.fn(),
}));

const { updateTemplateHandler } = await import("../updateTemplateHandler");
const { validateUpdateTemplateRequest } = await import(
  "@/lib/templates/validateUpdateTemplateRequest"
);
const { updateAgentTemplate } = await import("@/lib/supabase/agent_templates/updateAgentTemplate");
const { deleteAgentTemplateShares } = await import(
  "@/lib/supabase/agent_template_shares/deleteAgentTemplateShares"
);
const { insertAgentTemplateShares } = await import(
  "@/lib/supabase/agent_template_shares/insertAgentTemplateShares"
);
const { selectAgentTemplates } = await import(
  "@/lib/supabase/agent_templates/selectAgentTemplates"
);

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

describe("updateTemplateHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the template and replaces shares when share_emails provided", async () => {
    vi.mocked(validateUpdateTemplateRequest).mockResolvedValue({
      templateId: TEMPLATE_ID,
      accountId: ACCOUNT_ID,
      body: { title: "New Title", share_emails: ["x@y.com"] },
    });
    vi.mocked(updateAgentTemplate).mockResolvedValue({ id: TEMPLATE_ID } as never);
    vi.mocked(deleteAgentTemplateShares).mockResolvedValue(undefined);
    vi.mocked(insertAgentTemplateShares).mockResolvedValue(1);
    vi.mocked(selectAgentTemplates).mockResolvedValue([{ id: TEMPLATE_ID } as never]);

    const req = new NextRequest(`http://localhost/api/agents/templates/${TEMPLATE_ID}`, {
      method: "PATCH",
    });
    const res = await updateTemplateHandler(req, Promise.resolve({ id: TEMPLATE_ID }));

    expect(res.status).toBe(200);
    expect(updateAgentTemplate).toHaveBeenCalledWith(TEMPLATE_ID, { title: "New Title" });
    expect(deleteAgentTemplateShares).toHaveBeenCalledWith(TEMPLATE_ID);
    expect(insertAgentTemplateShares).toHaveBeenCalledWith(TEMPLATE_ID, ["x@y.com"]);
    expect(selectAgentTemplates).toHaveBeenCalledWith({ id: TEMPLATE_ID }, ACCOUNT_ID);
  });

  it("returns the validator error response when validation fails", async () => {
    const failure = NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
    vi.mocked(validateUpdateTemplateRequest).mockResolvedValue(failure);

    const req = new NextRequest(`http://localhost/api/agents/templates/${TEMPLATE_ID}`, {
      method: "PATCH",
    });
    const res = await updateTemplateHandler(req, Promise.resolve({ id: TEMPLATE_ID }));

    expect(res).toBe(failure);
    expect(updateAgentTemplate).not.toHaveBeenCalled();
  });
});
