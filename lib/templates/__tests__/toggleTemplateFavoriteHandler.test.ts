import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/templates/validateToggleFavoriteRequest", () => ({
  validateToggleFavoriteRequest: vi.fn(),
}));

vi.mock("@/lib/supabase/template_favorites/insertTemplateFavorite", () => ({
  insertTemplateFavorite: vi.fn(),
}));

vi.mock("@/lib/supabase/template_favorites/deleteTemplateFavorite", () => ({
  deleteTemplateFavorite: vi.fn(),
}));

const { toggleTemplateFavoriteHandler } = await import("../toggleTemplateFavoriteHandler");
const { validateToggleFavoriteRequest } = await import(
  "@/lib/templates/validateToggleFavoriteRequest"
);
const { insertTemplateFavorite } = await import(
  "@/lib/supabase/template_favorites/insertTemplateFavorite"
);
const { deleteTemplateFavorite } = await import(
  "@/lib/supabase/template_favorites/deleteTemplateFavorite"
);

const ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const TEMPLATE_ID = "22222222-2222-2222-2222-222222222222";

describe("toggleTemplateFavoriteHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a favorite when is_favourite is true", async () => {
    vi.mocked(validateToggleFavoriteRequest).mockResolvedValue({
      templateId: TEMPLATE_ID,
      accountId: ACCOUNT_ID,
      isFavourite: true,
    });
    vi.mocked(insertTemplateFavorite).mockResolvedValue(true);

    const req = new NextRequest(`http://localhost/api/agents/templates/${TEMPLATE_ID}/favorite`, {
      method: "PUT",
    });
    const res = await toggleTemplateFavoriteHandler(req, Promise.resolve({ id: TEMPLATE_ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "success" });
    expect(insertTemplateFavorite).toHaveBeenCalledWith(TEMPLATE_ID, ACCOUNT_ID);
    expect(deleteTemplateFavorite).not.toHaveBeenCalled();
  });

  it("deletes a favorite when is_favourite is false", async () => {
    vi.mocked(validateToggleFavoriteRequest).mockResolvedValue({
      templateId: TEMPLATE_ID,
      accountId: ACCOUNT_ID,
      isFavourite: false,
    });
    vi.mocked(deleteTemplateFavorite).mockResolvedValue(true);

    const req = new NextRequest(`http://localhost/api/agents/templates/${TEMPLATE_ID}/favorite`, {
      method: "PUT",
    });
    const res = await toggleTemplateFavoriteHandler(req, Promise.resolve({ id: TEMPLATE_ID }));
    expect(res.status).toBe(200);
    expect(deleteTemplateFavorite).toHaveBeenCalledWith(TEMPLATE_ID, ACCOUNT_ID);
    expect(insertTemplateFavorite).not.toHaveBeenCalled();
  });

  it("returns the validator error response on validation failure", async () => {
    const failure = NextResponse.json(
      { status: "error", error: "is_favourite is required" },
      { status: 400 },
    );
    vi.mocked(validateToggleFavoriteRequest).mockResolvedValue(failure);

    const req = new NextRequest(`http://localhost/api/agents/templates/${TEMPLATE_ID}/favorite`, {
      method: "PUT",
    });
    const res = await toggleTemplateFavoriteHandler(req, Promise.resolve({ id: TEMPLATE_ID }));
    expect(res).toBe(failure);
  });
});
