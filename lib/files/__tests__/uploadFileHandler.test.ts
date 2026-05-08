import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { uploadFileHandler } from "@/lib/files/uploadFileHandler";
import { uploadDataToPublicBucket } from "@/lib/files/uploadDataToPublicBucket";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/files/uploadDataToPublicBucket", () => ({
  uploadDataToPublicBucket: vi.fn(),
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
    vi.mocked(uploadDataToPublicBucket).mockResolvedValue({
      url: "https://example.supabase.co/storage/v1/object/public/public-uploads/abc.png",
      key: "abc.png",
    });

    const file = new File([new Uint8Array([1, 2, 3, 4])], "hello.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(uploadDataToPublicBucket).toHaveBeenCalledWith({
      data: expect.any(Buffer),
      contentType: "image/png",
      fileExtension: ".png",
    });
    const callArgs = vi.mocked(uploadDataToPublicBucket).mock.calls[0][0];
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
    vi.mocked(uploadDataToPublicBucket).mockResolvedValue({
      url: "https://example.supabase.co/storage/v1/object/public/public-uploads/x.bin",
      key: "x.bin",
    });

    const file = new File([new Uint8Array([9])], "blob.bin", { type: "" });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(uploadDataToPublicBucket).toHaveBeenCalledWith(
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
    expect(uploadDataToPublicBucket).not.toHaveBeenCalled();
  });

  it("returns 400 when file exceeds size cap", async () => {
    const big = new Uint8Array(26 * 1024 * 1024); // 26 MiB
    const file = new File([big], "big.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, error: "File too large" });
    expect(uploadDataToPublicBucket).not.toHaveBeenCalled();
  });

  it("returns 400 when mime is not in the allowlist", async () => {
    const file = new File([new Uint8Array([1])], "bad.exe", { type: "application/x-msdownload" });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ success: false, error: "Unsupported file type" });
    expect(uploadDataToPublicBucket).not.toHaveBeenCalled();
  });

  it("returns 500 with success:false when the upload helper throws", async () => {
    vi.mocked(uploadDataToPublicBucket).mockRejectedValue(new Error("network down"));

    const file = new File([new Uint8Array([1])], "x.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ success: false, error: "network down" });
  });
});
