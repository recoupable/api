import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mirrorPublicImage } from "../mirrorPublicImage";
import { uploadPublicAsset } from "../uploadPublicAsset";
vi.mock("../uploadPublicAsset", () => ({ uploadPublicAsset: vi.fn() }));
const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 255]);
describe("public profile-image mirroring", () => {
  const fetcher = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetcher);
    vi.mocked(uploadPublicAsset).mockResolvedValue({
      url: "https://storage/image",
      storageKey: "system/image",
    });
    fetcher.mockResolvedValue(new Response(bytes, { headers: { "content-type": "image/png" } }));
  });
  afterEach(() => vi.unstubAllGlobals());
  it("preserves image bytes, disables redirects and bounds fetch time", async () => {
    expect(await mirrorPublicImage("https://cdn.example/avatar.png")).toBe("https://storage/image");
    expect(fetcher).toHaveBeenCalledWith("https://cdn.example/avatar.png", {
      redirect: "error",
      signal: expect.any(AbortSignal),
    });
    expect(uploadPublicAsset).toHaveBeenCalledWith({ data: bytes, contentType: "image/png" });
  });
  it.each([
    "file:///etc/passwd",
    "http://127.0.0.1/a",
    "http://169.254.169.254/a",
    "http://10.0.0.1/a",
  ])("rejects unsafe URL %s before fetch", async url => {
    expect(await mirrorPublicImage(url)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });
  it("withholds unsupported or forged media", async () => {
    fetcher.mockResolvedValueOnce(
      new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } }),
    );
    expect(await mirrorPublicImage("https://cdn.example/avatar")).toBeNull();
    fetcher.mockResolvedValueOnce(
      new Response("forged", { headers: { "content-type": "image/png" } }),
    );
    expect(await mirrorPublicImage("https://cdn.example/avatar")).toBeNull();
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });
  it("caps advertised and streamed bytes", async () => {
    fetcher.mockResolvedValueOnce(
      new Response(bytes, {
        headers: { "content-type": "image/png", "content-length": String(11 * 1024 * 1024) },
      }),
    );
    expect(await mirrorPublicImage("https://cdn.example/avatar")).toBeNull();
    fetcher.mockResolvedValueOnce(
      new Response(new Uint8Array(10 * 1024 * 1024 + 1), {
        headers: { "content-type": "image/png" },
      }),
    );
    expect(await mirrorPublicImage("https://cdn.example/avatar")).toBeNull();
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });
  it("falls back without returning a durable URL on storage failure", async () => {
    vi.mocked(uploadPublicAsset).mockRejectedValueOnce(new Error("offline"));
    expect(await mirrorPublicImage("https://cdn.example/avatar")).toBeNull();
  });
});
