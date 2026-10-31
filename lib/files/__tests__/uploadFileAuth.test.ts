import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST, OPTIONS } from "@/app/api/upload/route";
import { getAuthenticatedAccountId } from "@/lib/auth/getAuthenticatedAccountId";
import { getApiKeyAccountId } from "@/lib/auth/getApiKeyAccountId";
import { validateAccountIdOverride } from "@/lib/auth/validateAccountIdOverride";
import { uploadPublicAsset } from "../uploadPublicAsset";
vi.mock("@/lib/auth/getAuthenticatedAccountId", () => ({ getAuthenticatedAccountId: vi.fn() }));
vi.mock("@/lib/auth/getApiKeyAccountId", () => ({ getApiKeyAccountId: vi.fn() }));
vi.mock("@/lib/auth/validateAccountIdOverride", () => ({ validateAccountIdOverride: vi.fn() }));
vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(),
}));
vi.mock("../uploadPublicAsset", () => ({ uploadPublicAsset: vi.fn() }));
function request(headers: Record<string, string>) {
  const form = new FormData();
  form.append("file", new File(["hello"], "hello.txt", { type: "text/plain" }));
  return new NextRequest("https://api.example/api/upload?account_id=forged", {
    method: "POST",
    headers,
    body: form,
  });
}
describe("upload route authentication contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedAccountId).mockResolvedValue("owner");
    vi.mocked(getApiKeyAccountId).mockResolvedValue("owner");
    vi.mocked(uploadPublicAsset).mockResolvedValue({
      url: "https://storage/file",
      storageKey: "owner/file",
    });
  });
  it.each([{}, { authorization: "Bearer token", "x-api-key": "key" }])(
    "rejects missing/dual credentials before consuming bytes",
    async headers => {
      const req = request(headers);
      const response = await POST(req);
      expect(response.status).toBe(401);
      expect(req.bodyUsed).toBe(false);
      expect(getAuthenticatedAccountId).not.toHaveBeenCalled();
      expect(getApiKeyAccountId).not.toHaveBeenCalled();
      expect(uploadPublicAsset).not.toHaveBeenCalled();
    },
  );
  it.each([{ authorization: "Bearer token" }, { "x-api-key": "key" }])(
    "supports a single credential without accepting an owner override",
    async headers => {
      const req = request(headers);
      expect((await POST(req)).status).toBe(200);
      if (headers.authorization)
        expect(getAuthenticatedAccountId).toHaveBeenCalledWith(req, {
          allowAccountCreation: false,
        });
      else expect(getApiKeyAccountId).toHaveBeenCalledWith(req);
      expect(validateAccountIdOverride).not.toHaveBeenCalled();
      expect(uploadPublicAsset).toHaveBeenCalledWith(
        expect.objectContaining({ uploaderAccountId: "owner" }),
      );
    },
  );
  it("preserves 401 and maps a malformed/invalid token message to the upload envelope", async () => {
    vi.mocked(getAuthenticatedAccountId).mockResolvedValue(
      NextResponse.json(
        { message: "Authorization header with Bearer token required" },
        { status: 401 },
      ),
    );
    const req = request({ authorization: "Basic invalid" });
    const response = await POST(req);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: "Authorization header with Bearer token required",
    });
    expect(req.bodyUsed).toBe(false);
  });
  it("answers browser preflight without credentials or storage access", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });
});
