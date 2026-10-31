import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadMediaBuffer } from "../downloadMediaBuffer";

afterEach(() => vi.restoreAllMocks());
describe("downloadMediaBuffer", () => {
  it("returns bytes and normalized reported MIME", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2]), {
        headers: { "content-type": "Image/JPEG; charset=binary" },
      }),
    );
    expect(await downloadMediaBuffer("https://cdn.example.com/image")).toEqual({
      buffer: Buffer.from([1, 2]),
      mimeType: "image/jpeg",
    });
  });
  it("retains bytes when no MIME was reported", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1])));
    expect(await downloadMediaBuffer("https://cdn.example.com/video")).toEqual({
      buffer: Buffer.from([1]),
      mimeType: null,
    });
  });
  it("returns null for an unsuccessful HTTP response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    expect(await downloadMediaBuffer("https://cdn.example.com/missing")).toBeNull();
  });
  it("returns null for network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fixture network error"));
    expect(await downloadMediaBuffer("https://cdn.example.com/image")).toBeNull();
  });
});
