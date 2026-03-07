import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getContentTemplatesHandler } from "@/lib/content/getContentTemplatesHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

describe("getContentTemplatesHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth error when auth validation fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ status: "error", error: "Unauthorized" }, { status: 401 }),
    );
    const request = new NextRequest("http://localhost/api/content/templates", { method: "GET" });

    const result = await getContentTemplatesHandler(request);

    expect(result.status).toBe(401);
  });

  it("returns templates when authenticated", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "test-key",
    });
    const request = new NextRequest("http://localhost/api/content/templates", { method: "GET" });

    const result = await getContentTemplatesHandler(request);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.status).toBe("success");
    expect(Array.isArray(body.templates)).toBe(true);
    expect(body.templates.length).toBeGreaterThan(0);
  });
});
