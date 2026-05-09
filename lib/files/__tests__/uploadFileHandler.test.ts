import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { uploadFileHandler } from "@/lib/files/uploadFileHandler";
import { uploadPublicAsset } from "@/lib/files/uploadPublicAsset";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/files/uploadPublicAsset", () => ({
  uploadPublicAsset: vi.fn(),
}));

const buildRequest = (formData: FormData) =>
  new NextRequest("https://example.com/api/upload", {
    method: "POST",
    body: formData,
  });

describe("uploadFileHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads the file and returns the public URL", async () => {
    vi.mocked(uploadPublicAsset).mockResolvedValue({
      url: "https://example.supabase.co/storage/v1/object/public/public-uploads/abc.png",
      id: "abc",
    });

    const file = new File([new Uint8Array([1, 2, 3, 4])], "hello.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(uploadPublicAsset).toHaveBeenCalledWith({
      data: expect.any(Buffer),
      contentType: "image/png",
    });
    const callArgs = vi.mocked(uploadPublicAsset).mock.calls[0][0];
    expect((callArgs.data as Buffer).length).toBe(4);
    expect(body).toEqual({
      success: true,
      fileName: "hello.png",
      fileType: "image/png",
      fileSize: 4,
      url: "https://example.supabase.co/storage/v1/object/public/public-uploads/abc.png",
    });
  });

  it("falls back to application/octet-stream when file.type is empty (and accepts the upload)", async () => {
    vi.mocked(uploadPublicAsset).mockResolvedValue({
      url: "https://example.supabase.co/storage/v1/object/public/public-uploads/x.bin",
      id: "xyz",
    });

    const file = new File([new Uint8Array([9])], "blob.bin", { type: "" });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(uploadPublicAsset).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "application/octet-stream" }),
    );
    expect(body.fileType).toBe("application/octet-stream");
  });

  it("returns 400 with success:false when no file is provided", async () => {
    const formData = new FormData();
    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, error: "No file provided" });
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });

  it("returns 400 when mime is not in the allowlist", async () => {
    const file = new File([new Uint8Array([1])], "bad.exe", { type: "application/x-msdownload" });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, error: "Unsupported file type" });
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });

  it("returns 500 with success:false when the upload helper throws", async () => {
    vi.mocked(uploadPublicAsset).mockRejectedValue(new Error("network down"));

    const file = new File([new Uint8Array([1])], "x.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ success: false, error: "network down" });
  });
});
