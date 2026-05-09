import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleUpload } from "@vercel/blob/client";

import { postSandboxesUploadTokensHandler } from "../postSandboxesUploadTokensHandler";

vi.mock("@vercel/blob/client", () => ({
  handleUpload: vi.fn(),
}));

function createMockRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/sandboxes/staged-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("postSandboxesUploadTokensHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the handleUpload result on success", async () => {
    const blobResponse = { type: "blob.generate-client-token", clientToken: "tkn_abc" };
    vi.mocked(handleUpload).mockResolvedValue(blobResponse as never);

    const request = createMockRequest({ pathname: "file.png", callbackUrl: "x" });
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(blobResponse);
    expect(handleUpload).toHaveBeenCalledOnce();
  });

  it("rejects when clientPayload is missing a token", async () => {
    vi.mocked(handleUpload).mockImplementation(async ({ onBeforeGenerateToken }) => {
      await onBeforeGenerateToken!("file.png", null, false);
      return {} as never;
    });

    const request = createMockRequest({});
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Authentication required");
  });

  it("rejects when clientPayload token field is missing", async () => {
    vi.mocked(handleUpload).mockImplementation(async ({ onBeforeGenerateToken }) => {
      await onBeforeGenerateToken!("file.png", JSON.stringify({ foo: "bar" }), false);
      return {} as never;
    });

    const request = createMockRequest({});
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Authentication required");
  });

  it("returns the configured upload constraints when clientPayload has a token", async () => {
    let constraints: unknown;
    vi.mocked(handleUpload).mockImplementation(async ({ onBeforeGenerateToken }) => {
      constraints = await onBeforeGenerateToken!(
        "file.png",
        JSON.stringify({ token: "user-access-token" }),
        false,
      );
      return { type: "blob.generate-client-token" } as never;
    });

    const request = createMockRequest({});
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.status).toBe(200);
    expect(constraints).toEqual({
      maximumSizeInBytes: 100 * 1024 * 1024,
      addRandomSuffix: true,
    });
  });

  it("returns 400 when handleUpload throws", async () => {
    vi.mocked(handleUpload).mockRejectedValue(new Error("blob client failure"));

    const request = createMockRequest({});
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("blob client failure");
  });

  it("includes CORS headers on success", async () => {
    vi.mocked(handleUpload).mockResolvedValue({ type: "blob.generate-client-token" } as never);

    const request = createMockRequest({});
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes CORS headers on error", async () => {
    vi.mocked(handleUpload).mockRejectedValue(new Error("nope"));

    const request = createMockRequest({});
    const response = await postSandboxesUploadTokensHandler(request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
