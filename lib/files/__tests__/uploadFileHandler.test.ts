import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { uploadFileHandler } from "@/lib/files/uploadFileHandler";
import { uploadPublicAsset } from "@/lib/files/uploadPublicAsset";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/files/uploadPublicAsset", () => ({ uploadPublicAsset: vi.fn() }));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const TEST_ACCOUNT_ID = "test-account-id";

const uploadWith = async (file: File | null) => {
  const fd = new FormData();
  if (file) fd.append("file", file);
  const res = await uploadFileHandler(
    new NextRequest("https://example.com/api/upload", { method: "POST", body: fd }),
  );
  return { res, body: await res.json() };
};

describe("uploadFileHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: TEST_ACCOUNT_ID,
      orgId: null,
      authToken: "test-token",
    });
  });

  it("uploads with uploader metadata and returns the public URL", async () => {
    vi.mocked(uploadPublicAsset).mockResolvedValue({ url: "https://cdn/abc.png", id: "abc" });
    const { res, body } = await uploadWith(
      new File([new Uint8Array([1, 2, 3, 4])], "hello.png", { type: "image/png" }),
    );
    expect(res.status).toBe(200);
    expect(uploadPublicAsset).toHaveBeenCalledWith({
      data: expect.any(Buffer),
      contentType: "image/png",
      metadata: { uploaded_by: TEST_ACCOUNT_ID },
    });
    expect(body).toEqual({
      success: true,
      fileName: "hello.png",
      fileType: "image/png",
      fileSize: 4,
      url: "https://cdn/abc.png",
    });
  });

  it("returns the auth response when validateAuthContext rejects", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    );
    const { res } = await uploadWith(
      new File([new Uint8Array([1])], "x.png", { type: "image/png" }),
    );
    expect(res.status).toBe(401);
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is provided", async () => {
    const { res, body } = await uploadWith(null);
    expect(res.status).toBe(400);
    expect(body).toEqual({ success: false, error: "No file provided" });
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });

  it.each([
    ["typeless", ""],
    ["disallowed mime", "application/x-msdownload"],
  ])("returns 415 for %s files", async (_, type) => {
    const { res, body } = await uploadWith(new File([new Uint8Array([1])], "x", { type }));
    expect(res.status).toBe(415);
    expect(body).toEqual({ success: false, error: "Unsupported file type" });
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });

  it("returns 500 with a generic message when the upload helper throws", async () => {
    vi.mocked(uploadPublicAsset).mockRejectedValue(new Error("network down"));
    const { res, body } = await uploadWith(
      new File([new Uint8Array([1])], "x.png", { type: "image/png" }),
    );
    expect(res.status).toBe(500);
    expect(body).toEqual({ success: false, error: "Internal server error" });
  });
});
