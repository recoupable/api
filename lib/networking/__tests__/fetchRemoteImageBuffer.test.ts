import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRemoteImageBuffer } from "@/lib/networking/fetchRemoteImageBuffer";
import { isSafeHttpUrl } from "@/lib/networking/isSafeHttpUrl";

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

describe("fetchRemoteImageBuffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSafeHttpUrl).mockReturnValue(true);
  });

  it("returns null for null/undefined/empty input without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await fetchRemoteImageBuffer(null)).toBeNull();
    expect(await fetchRemoteImageBuffer(undefined)).toBeNull();
    expect(await fetchRemoteImageBuffer("")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns null when isSafeHttpUrl rejects the URL", async () => {
    vi.mocked(isSafeHttpUrl).mockReturnValueOnce(false);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await fetchRemoteImageBuffer("file:///etc/passwd")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns null when the response is not an image", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockOkResponse({ contentType: "text/html", body: new Uint8Array([1]) }),
      );
    expect(await fetchRemoteImageBuffer("https://example.com/x")).toBeNull();
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
    expect(await fetchRemoteImageBuffer("https://example.com/x.png")).toBeNull();
    fetchSpy.mockRestore();
  });

  it("returns the buffer + content-type on a valid image response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockOkResponse({
        contentType: "image/png",
        body: new Uint8Array([1, 2, 3, 4]),
        contentLength: "4",
      }),
    );

    const result = await fetchRemoteImageBuffer("https://example.com/img.png");
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/png");
    expect(result!.buffer).toBeInstanceOf(Buffer);
    expect(result!.buffer.length).toBe(4);
    fetchSpy.mockRestore();
  });

  it("returns null when fetch throws", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("ETIMEDOUT"));
    expect(await fetchRemoteImageBuffer("https://example.com/x.png")).toBeNull();
    fetchSpy.mockRestore();
  });
});
