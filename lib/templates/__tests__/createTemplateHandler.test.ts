import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/templates/insertTemplate", () => ({
  insertTemplate: vi.fn(),
}));

vi.mock("@/lib/supabase/template_shares/insertTemplateShares", () => ({
  insertTemplateShares: vi.fn(),
}));

vi.mock("@/lib/supabase/templates/selectTemplates", () => ({
  selectTemplates: vi.fn(),
}));

const { createTemplateHandler } = await import("../createTemplateHandler");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { insertTemplate } = await import("@/lib/supabase/templates/insertTemplate");
const { insertTemplateShares } = await import(
  "@/lib/supabase/template_shares/insertTemplateShares"
);
const { selectTemplates } = await import("@/lib/supabase/templates/selectTemplates");

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

const mockAuthOk = () =>
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: ACCOUNT_ID,
    orgId: null,
    authToken: "k",
  });

const makeRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/agents/templates", {
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

describe("createTemplateHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a template and shares emails when private", async () => {
    mockAuthOk();
    vi.mocked(insertTemplate).mockResolvedValue({ id: TEMPLATE_ID } as never);
    vi.mocked(insertTemplateShares).mockResolvedValue(1);
    vi.mocked(selectTemplates).mockResolvedValue([{ id: TEMPLATE_ID } as never]);

    const res = await createTemplateHandler(
      makeRequest({ ...validBody, is_private: true, share_emails: ["a@x.com"] }),
    );

    expect(res.status).toBe(201);
    expect((await res.json()).template.id).toBe(TEMPLATE_ID);
    expect(insertTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ creator: ACCOUNT_ID, is_private: true }),
    );
    expect(insertTemplateShares).toHaveBeenCalledWith(TEMPLATE_ID, ["a@x.com"]);
    expect(selectTemplates).toHaveBeenCalledWith({ id: TEMPLATE_ID }, ACCOUNT_ID);
  });

  it("returns 400 when validation fails", async () => {
    mockAuthOk();
    const res = await createTemplateHandler(makeRequest({ title: "no" }));
    expect(res.status).toBe(400);
    expect(insertTemplate).not.toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    const failure = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);
    const res = await createTemplateHandler(makeRequest(validBody));
    expect(res).toBe(failure);
  });
});
