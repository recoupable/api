import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/templates/validateDeleteTemplateRequest", () => ({
  validateDeleteTemplateRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_templates/deleteAgentTemplate", () => ({
  deleteAgentTemplate: vi.fn(),
}));

const { deleteTemplateHandler } = await import("../deleteTemplateHandler");
const { validateDeleteTemplateRequest } = await import(
  "@/lib/templates/validateDeleteTemplateRequest"
);
const { deleteAgentTemplate } = await import("@/lib/supabase/agent_templates/deleteAgentTemplate");

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

describe("deleteTemplateHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success when delete succeeds", async () => {
    vi.mocked(validateDeleteTemplateRequest).mockResolvedValue({
      templateId: TEMPLATE_ID,
      accountId: ACCOUNT_ID,
    });
    vi.mocked(deleteAgentTemplate).mockResolvedValue(true);

    const req = new NextRequest(`http://localhost/api/agents/templates/${TEMPLATE_ID}`, {
      method: "DELETE",
    });
    const res = await deleteTemplateHandler(req, Promise.resolve({ id: TEMPLATE_ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });
  });

  it("returns the validator error response when ownership fails", async () => {
    const failure = NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
    vi.mocked(validateDeleteTemplateRequest).mockResolvedValue(failure);

    const req = new NextRequest(`http://localhost/api/agents/templates/${TEMPLATE_ID}`, {
      method: "DELETE",
    });
    const res = await deleteTemplateHandler(req, Promise.resolve({ id: TEMPLATE_ID }));
    expect(res).toBe(failure);
    expect(deleteAgentTemplate).not.toHaveBeenCalled();
  });
});
