import { describe, it, expect, vi, beforeEach } from "vitest";
import { mirrorUrlToPublicBucket } from "@/lib/files/mirrorUrlToPublicBucket";
import { uploadDataToPublicBucket } from "@/lib/files/uploadDataToPublicBucket";
import { isSafeHttpUrl } from "@/lib/networking/isSafeHttpUrl";

vi.mock("@/lib/files/uploadDataToPublicBucket", () => ({
  uploadDataToPublicBucket: vi.fn(),
}));

vi.mock("@/lib/networking/isSafeHttpUrl", () => ({
  isSafeHttpUrl: vi.fn(),
}));

function mockOkResponse({
  contentType,
  body,
  contentLength,
}: {
  contentType: string;
  body: Uint8Array;
  contentLength?: string;
}): Response {
  const headers = new Headers({ "content-type": contentType });
  if (contentLength) headers.set("content-length", contentLength);
  return new Response(body, { status: 200, headers });
}

describe("mirrorUrlToPublicBucket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSafeHttpUrl).mockReturnValue(true);
  });

  it("returns null for null/undefined/empty input without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await mirrorUrlToPublicBucket(null)).toBeNull();
    expect(await mirrorUrlToPublicBucket(undefined)).toBeNull();
    expect(await mirrorUrlToPublicBucket("")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns null when isSafeHttpUrl rejects the URL", async () => {
    vi.mocked(isSafeHttpUrl).mockReturnValueOnce(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await mirrorUrlToPublicBucket("file:///etc/passwd")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns null when the response is not an image", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockOkResponse({ contentType: "text/html", body: new Uint8Array([1]) }),
      );
    expect(await mirrorUrlToPublicBucket("https://example.com/x")).toBeNull();
    expect(uploadDataToPublicBucket).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns null when content-length is over the 10 MiB cap", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockOkResponse({
        contentType: "image/png",
        body: new Uint8Array([1]),
        contentLength: String(11 * 1024 * 1024),
      }),
    );
    expect(await mirrorUrlToPublicBucket("https://example.com/x.png")).toBeNull();
    expect(uploadDataToPublicBucket).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("uploads valid image and returns the public URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockOkResponse({
        contentType: "image/png",
        body: new Uint8Array([1, 2, 3, 4]),
        contentLength: "4",
      }),
    );
    vi.mocked(uploadDataToPublicBucket).mockResolvedValueOnce({
      url: "https://example.supabase.co/storage/v1/object/public/public-uploads/abc.png",
      key: "abc.png",
    });

    const result = await mirrorUrlToPublicBucket("https://example.com/img.png");
    expect(result).toBe(
      "https://example.supabase.co/storage/v1/object/public/public-uploads/abc.png",
    );
    expect(uploadDataToPublicBucket).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "image/png" }),
    );
    fetchSpy.mockRestore();
  });

  it("returns null when fetch throws", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ETIMEDOUT"));
    expect(await mirrorUrlToPublicBucket("https://example.com/x.png")).toBeNull();
    expect(uploadDataToPublicBucket).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
