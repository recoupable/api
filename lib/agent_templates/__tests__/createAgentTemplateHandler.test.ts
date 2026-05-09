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

vi.mock("@/lib/supabase/agent_templates/getAgentTemplateWithDetails", () => ({
  getAgentTemplateWithDetails: vi.fn(),
}));

const { createAgentTemplateHandler } = await import("../createAgentTemplateHandler");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");
const { insertAgentTemplate } = await import("@/lib/supabase/agent_templates/insertAgentTemplate");
const { insertAgentTemplateShares } = await import(
  "@/lib/supabase/agent_template_shares/insertAgentTemplateShares"
);
const { getAgentTemplateWithDetails } = await import(
  "@/lib/supabase/agent_templates/getAgentTemplateWithDetails"
);

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/agent-templates", {
    method: "POST",
    headers: { "x-api-key": "k", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("createAgentTemplateHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a template and shares emails when private", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: ACCOUNT_ID,
      orgId: null,
      authToken: "k",
    });

    vi.mocked(insertAgentTemplate).mockResolvedValue({ id: TEMPLATE_ID } as any);
    vi.mocked(insertAgentTemplateShares).mockResolvedValue(1);
    vi.mocked(getAgentTemplateWithDetails).mockResolvedValue({
      id: TEMPLATE_ID,
      title: "Hello world title",
    } as any);

    const req = makeRequest({
      title: "My Template",
      description: "A useful description",
      prompt: "This is the prompt content for the template",
      tags: ["a", "b"],
      is_private: true,
      share_emails: ["a@x.com"],
    });

    const res = await createAgentTemplateHandler(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.template.id).toBe(TEMPLATE_ID);
    expect(insertAgentTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ creator: ACCOUNT_ID, is_private: true }),
    );
    expect(insertAgentTemplateShares).toHaveBeenCalledWith(TEMPLATE_ID, ["a@x.com"]);
  });

  it("returns 400 when validation fails", async () => {
    const req = makeRequest({ title: "no" });
    const res = await createAgentTemplateHandler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(validateAuthContext).not.toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    const failure = NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(failure);
    const req = makeRequest({
      title: "Valid title",
      description: "valid description",
      prompt: "Valid prompt content for template",
      tags: [],
      is_private: false,
      share_emails: [],
    });
    const res = await createAgentTemplateHandler(req);
    expect(res).toBe(failure);
  });
});
