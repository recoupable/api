import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { validateGetSandboxesFileRequest } from "../validateGetSandboxesFileRequest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { buildGetSandboxesParams } from "../buildGetSandboxesParams";

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

vi.mock("../buildGetSandboxesParams", () => ({
  buildGetSandboxesParams: vi.fn(),
}));

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

/**
 * Creates a mock NextRequest with query parameters.
 *
 * @param queryParams - Key-value pairs to set as URL search parameters
 * @returns A mock NextRequest object
 */
function createMockRequest(queryParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/sandboxes/file");
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return {
    url: url.toString(),
    headers: new Headers({ "x-api-key": "test-key" }),
  } as unknown as NextRequest;
}

describe("validateGetSandboxesFileRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when path is missing", async () => {
    const request = createMockRequest();
    const result = await validateGetSandboxesFileRequest(request);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns validated params for basic request", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "token",
    });
    vi.mocked(buildGetSandboxesParams).mockResolvedValue({
      params: { accountIds: ["acc_123"], sandboxId: undefined },
      error: null,
    });

    const request = createMockRequest({ path: "src/index.ts" });
    const result = await validateGetSandboxesFileRequest(request);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({
      accountIds: ["acc_123"],
      orgId: undefined,
      path: "src/index.ts",
    });
  });

  describe("account_id query parameter", () => {
    it("passes account_id as target_account_id to buildGetSandboxesParams", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "token",
      });
      vi.mocked(buildGetSandboxesParams).mockResolvedValue({
        params: { accountIds: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"], sandboxId: undefined },
        error: null,
      });

      const request = createMockRequest({
        path: "src/index.ts",
        account_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      });
      const result = await validateGetSandboxesFileRequest(request);

      expect(buildGetSandboxesParams).toHaveBeenCalledWith({
        account_id: "acc_123",
        target_account_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      });
      expect(result).toEqual({
        accountIds: ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
        orgId: undefined,
        path: "src/index.ts",
      });
    });

    it("returns 403 when access denied to target account", async () => {
      vi.mocked(validateAuthContext).mockResolvedValue({
        accountId: "acc_123",
        orgId: null,
        authToken: "token",
      });
      vi.mocked(buildGetSandboxesParams).mockResolvedValue({
        params: null,
        error: "Access denied to specified account_id",
      });

      const request = createMockRequest({
        path: "src/index.ts",
        account_id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      });
      const result = await validateGetSandboxesFileRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(403);
    });

    it("returns 400 for invalid account_id format", async () => {
      const request = createMockRequest({
        path: "src/index.ts",
        account_id: "not-a-uuid",
      });
      const result = await validateGetSandboxesFileRequest(request);

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
  });
});
