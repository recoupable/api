import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getContentTemplateDetailHandler } from "@/lib/content/getContentTemplateDetailHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { loadTemplate } from "@/lib/content/templates";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("@/lib/content/templates", () => ({
  loadTemplate: vi.fn(),
}));

describe("getContentTemplateDetailHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );
    const request = new NextRequest("http://localhost/api/content/templates/bedroom", {
      method: "GET",
    });

    const result = await getContentTemplateDetailHandler(request, {
      params: Promise.resolve({ id: "bedroom" }),
    });

    expect(result.status).toBe(401);
  });

  it("returns 404 for unknown template", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "test-key",
    });
    vi.mocked(loadTemplate).mockReturnValue(null);

    const request = new NextRequest("http://localhost/api/content/templates/nonexistent", {
      method: "GET",
    });

    const result = await getContentTemplateDetailHandler(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const body = await result.json();

    expect(result.status).toBe(404);
    expect(body.error).toBe("Template not found");
  });

  it("returns full template for valid id", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "test-key",
    });
    const mockTemplate = {
      id: "artist-caption-bedroom",
      description: "Moody purple bedroom setting",
      image: { prompt: "test", reference_images: [], style_rules: {} },
      video: { moods: ["calm"], movements: ["slow pan"] },
      caption: { guide: { tone: "dreamy", rules: [], formats: [] }, examples: [] },
      edit: { operations: [] },
    };
    vi.mocked(loadTemplate).mockReturnValue(mockTemplate);

    const request = new NextRequest(
      "http://localhost/api/content/templates/artist-caption-bedroom",
      { method: "GET" },
    );

    const result = await getContentTemplateDetailHandler(request, {
      params: Promise.resolve({ id: "artist-caption-bedroom" }),
    });
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.id).toBe("artist-caption-bedroom");
    expect(body.description).toBe("Moody purple bedroom setting");
    expect(body.image).toBeDefined();
    expect(body.video).toBeDefined();
    expect(body.caption).toBeDefined();
    expect(body.edit).toBeDefined();
  });
});
