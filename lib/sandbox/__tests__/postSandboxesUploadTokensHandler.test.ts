import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { handleUpload } from "@vercel/blob/client";

import { postSandboxesUploadTokensHandler } from "../postSandboxesUploadTokensHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@vercel/blob/client", () => ({
  handleUpload: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

function createMockRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new Request("http://localhost:3000/api/sandboxes/staged-file", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const handshakeBody = { type: "blob.generate-client-token", payload: {} };
const callbackBody = { type: "blob.upload-completed", payload: {} };

describe("postSandboxesUploadTokensHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "tkn",
    });
  });

  it("returns 200 with the handleUpload result on a valid handshake", async () => {
    const blobResponse = { type: "blob.generate-client-token", clientToken: "tkn_abc" };
    vi.mocked(handleUpload).mockResolvedValue(blobResponse as never);

    const request = createMockRequest(handshakeBody, { Authorization: "Bearer xyz" });
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(blobResponse);
    expect(validateAuthContext).toHaveBeenCalledOnce();
    expect(handleUpload).toHaveBeenCalledOnce();
  });

  it("returns 401 when handshake auth fails", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = createMockRequest(handshakeBody);
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.status).toBe(401);
    expect(handleUpload).not.toHaveBeenCalled();
  });

  it("skips auth on the upload-completed callback", async () => {
    vi.mocked(handleUpload).mockResolvedValue({ type: "blob.upload-completed" } as never);

    const request = createMockRequest(callbackBody);
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.status).toBe(200);
    expect(validateAuthContext).not.toHaveBeenCalled();
    expect(handleUpload).toHaveBeenCalledOnce();
  });

  it("configures the upload constraints in onBeforeGenerateToken", async () => {
    let constraints: unknown;
    vi.mocked(handleUpload).mockImplementation(async ({ onBeforeGenerateToken }) => {
      constraints = await onBeforeGenerateToken!("file.png", null, false);
      return { type: "blob.generate-client-token" } as never;
    });

    const request = createMockRequest(handshakeBody, { Authorization: "Bearer xyz" });
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.status).toBe(200);
    expect(constraints).toEqual({
      maximumSizeInBytes: 100 * 1024 * 1024,
      addRandomSuffix: true,
    });
  });

  it("returns 500 with a generic message when handleUpload throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(handleUpload).mockRejectedValue(new Error("blob client failure"));

    const request = createMockRequest(handshakeBody, { Authorization: "Bearer xyz" });
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ status: "error", error: "Failed to issue upload token" });
    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it("includes CORS headers on success", async () => {
    vi.mocked(handleUpload).mockResolvedValue({ type: "blob.generate-client-token" } as never);

    const request = createMockRequest(handshakeBody, { Authorization: "Bearer xyz" });
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS headers on error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(handleUpload).mockRejectedValue(new Error("nope"));

    const request = createMockRequest(handshakeBody, { Authorization: "Bearer xyz" });
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    consoleSpy.mockRestore();
  });
});
