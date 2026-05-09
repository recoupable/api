import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/agent_templates/validateToggleFavoriteRequest", () => ({
  validateToggleFavoriteRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_template_favorites/insertAgentTemplateFavorite", () => ({
  insertAgentTemplateFavorite: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_template_favorites/deleteAgentTemplateFavorite", () => ({
  deleteAgentTemplateFavorite: vi.fn(),
}));

const { toggleAgentTemplateFavoriteHandler } = await import(
  "../toggleAgentTemplateFavoriteHandler"
);
const { validateToggleFavoriteRequest } = await import(
  "@/lib/agent_templates/validateToggleFavoriteRequest"
);
const { insertAgentTemplateFavorite } = await import(
  "@/lib/supabase/agent_template_favorites/insertAgentTemplateFavorite"
);
const { deleteAgentTemplateFavorite } = await import(
  "@/lib/supabase/agent_template_favorites/deleteAgentTemplateFavorite"
);

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

describe("toggleAgentTemplateFavoriteHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a favorite when is_favourite is true", async () => {
    vi.mocked(validateToggleFavoriteRequest).mockResolvedValue({
      templateId: TEMPLATE_ID,
      accountId: ACCOUNT_ID,
      isFavourite: true,
    });
    vi.mocked(insertAgentTemplateFavorite).mockResolvedValue(true);

    const req = new NextRequest(`http://localhost/api/agent-templates/${TEMPLATE_ID}/favorite`, {
      method: "PUT",
    });
    const res = await toggleAgentTemplateFavoriteHandler(req, Promise.resolve({ id: TEMPLATE_ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });
    expect(insertAgentTemplateFavorite).toHaveBeenCalledWith(TEMPLATE_ID, ACCOUNT_ID);
    expect(deleteAgentTemplateFavorite).not.toHaveBeenCalled();
  });

  it("deletes a favorite when is_favourite is false", async () => {
    vi.mocked(validateToggleFavoriteRequest).mockResolvedValue({
      templateId: TEMPLATE_ID,
      accountId: ACCOUNT_ID,
      isFavourite: false,
    });
    vi.mocked(deleteAgentTemplateFavorite).mockResolvedValue(true);

    const req = new NextRequest(`http://localhost/api/agent-templates/${TEMPLATE_ID}/favorite`, {
      method: "PUT",
    });
    const res = await toggleAgentTemplateFavoriteHandler(req, Promise.resolve({ id: TEMPLATE_ID }));
    expect(res.status).toBe(200);
    expect(deleteAgentTemplateFavorite).toHaveBeenCalledWith(TEMPLATE_ID, ACCOUNT_ID);
    expect(insertAgentTemplateFavorite).not.toHaveBeenCalled();
  });

  it("returns the validator error response on validation failure", async () => {
    const failure = NextResponse.json(
      { status: "error", error: "is_favourite is required" },
      { status: 400 },
    );
    vi.mocked(validateToggleFavoriteRequest).mockResolvedValue(failure);

    const req = new NextRequest(`http://localhost/api/agent-templates/${TEMPLATE_ID}/favorite`, {
      method: "PUT",
    });
    const res = await toggleAgentTemplateFavoriteHandler(req, Promise.resolve({ id: TEMPLATE_ID }));
    expect(res).toBe(failure);
  });
});
