import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/templates/validateUpdateTemplateRequest", () => ({
  validateUpdateTemplateRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/templates/updateTemplate", () => ({
  updateTemplate: vi.fn(),
}));

vi.mock("@/lib/supabase/template_shares/deleteTemplateShares", () => ({
  deleteTemplateShares: vi.fn(),
}));

vi.mock("@/lib/supabase/template_shares/insertTemplateShares", () => ({
  insertTemplateShares: vi.fn(),
}));

vi.mock("@/lib/supabase/templates/selectTemplates", () => ({
  selectTemplates: vi.fn(),
}));

const { updateTemplateHandler } = await import("../updateTemplateHandler");
const { validateUpdateTemplateRequest } = await import(
  "@/lib/templates/validateUpdateTemplateRequest"
);
const { updateTemplate } = await import("@/lib/supabase/templates/updateTemplate");
const { deleteTemplateShares } = await import(
  "@/lib/supabase/template_shares/deleteTemplateShares"
);
const { insertTemplateShares } = await import(
  "@/lib/supabase/template_shares/insertTemplateShares"
);
const { selectTemplates } = await import("@/lib/supabase/templates/selectTemplates");

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
    vi.mocked(updateTemplate).mockResolvedValue({ id: TEMPLATE_ID } as never);
    vi.mocked(deleteTemplateShares).mockResolvedValue(undefined);
    vi.mocked(insertTemplateShares).mockResolvedValue(1);
    vi.mocked(selectTemplates).mockResolvedValue([{ id: TEMPLATE_ID } as never]);

    const req = new NextRequest(`http://localhost/api/templates/${TEMPLATE_ID}`, {
      method: "PATCH",
    });
    const res = await updateTemplateHandler(req, Promise.resolve({ id: TEMPLATE_ID }));

    expect(res.status).toBe(200);
    expect(updateTemplate).toHaveBeenCalledWith(TEMPLATE_ID, { title: "New Title" });
    expect(deleteTemplateShares).toHaveBeenCalledWith(TEMPLATE_ID);
    expect(insertTemplateShares).toHaveBeenCalledWith(TEMPLATE_ID, ["x@y.com"]);
    expect(selectTemplates).toHaveBeenCalledWith({ id: TEMPLATE_ID }, ACCOUNT_ID);
  });

  it("returns the validator error response when validation fails", async () => {
    const failure = NextResponse.json({ status: "error", error: "Forbidden" }, { status: 403 });
    vi.mocked(validateUpdateTemplateRequest).mockResolvedValue(failure);

    const req = new NextRequest(`http://localhost/api/templates/${TEMPLATE_ID}`, {
      method: "PATCH",
    });
    const res = await updateTemplateHandler(req, Promise.resolve({ id: TEMPLATE_ID }));

    expect(res).toBe(failure);
    expect(updateTemplate).not.toHaveBeenCalled();
  });
});
