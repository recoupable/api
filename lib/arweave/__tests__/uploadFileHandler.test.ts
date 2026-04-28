import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { uploadFileHandler } from "@/lib/arweave/uploadFileHandler";
import { uploadToArweave } from "@/lib/arweave/uploadToArweave";
import { getFetchableUrl } from "@/lib/arweave/getFetchableUrl";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/arweave/uploadToArweave", () => ({
  uploadToArweave: vi.fn(),
}));

vi.mock("@/lib/arweave/getFetchableUrl", () => ({
  getFetchableUrl: vi.fn(),
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

  it("uploads the file and returns the gateway URL", async () => {
    vi.mocked(uploadToArweave).mockResolvedValue({ id: "tx_abc" } as never);
    vi.mocked(getFetchableUrl).mockReturnValue("https://arweave.net/tx_abc");

    const file = new File([new Uint8Array([1, 2, 3, 4])], "hello.png", {
      type: "image/png",
    });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(uploadToArweave).toHaveBeenCalledWith(expect.any(Buffer), "image/png");
    const [bufferArg] = vi.mocked(uploadToArweave).mock.calls[0];
    expect((bufferArg as Buffer).length).toBe(4);
    expect(getFetchableUrl).toHaveBeenCalledWith("ar://tx_abc");
    expect(body).toEqual({
      success: true,
      fileName: "hello.png",
      fileType: "image/png",
      fileSize: 4,
      url: "https://arweave.net/tx_abc",
    });
  });

  it("falls back to application/octet-stream when file.type is empty", async () => {
    vi.mocked(uploadToArweave).mockResolvedValue({ id: "tx_xyz" } as never);
    vi.mocked(getFetchableUrl).mockReturnValue("https://arweave.net/tx_xyz");

    const file = new File([new Uint8Array([9])], "blob.bin", { type: "" });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(uploadToArweave).toHaveBeenCalledWith(expect.any(Buffer), "application/octet-stream");
    expect(body.fileType).toBe("application/octet-stream");
  });

  it("returns 500 with success:false when no file is provided", async () => {
    const formData = new FormData();
    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ success: false, error: "No file provided" });
    expect(uploadToArweave).not.toHaveBeenCalled();
  });

  it("returns 500 with success:false when uploadToArweave throws", async () => {
    vi.mocked(uploadToArweave).mockRejectedValue(new Error("network down"));

    const file = new File([new Uint8Array([1])], "x.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadFileHandler(buildRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ success: false, error: "network down" });
  });
});
