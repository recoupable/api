import { describe, expect, it, vi } from "vitest";
import { uploadPackAsset } from "../uploadPackAsset";
import { fetchPackMedia } from "../fetchPackMedia";
import { storePackFile } from "../storePackFile";
vi.mock("../fetchPackMedia", () => ({
  fetchPackMedia: vi.fn(async () => ({
    bytes: Buffer.from([0x49, 0x44, 0x33, 0, 0, 0, 0, 0]),
    contentType: "application/octet-stream",
  })),
}));
vi.mock("../storePackFile", () => ({
  storePackFile: vi.fn(async () => ({
    storage_key: "owner/release-packs/selected.mp3",
    url: "https://owned.example/selected.mp3",
    bytes: 8,
    content_type: "audio/mpeg",
  })),
}));
vi.mock("@/lib/supabase/storage/createPackSignedUpload", () => ({
  createPackSignedUpload: vi.fn(),
}));
vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: vi.fn(),
}));
describe("selected ChatGPT attachment bridge", () => {
  it("imports only the selected signed download URL and infers media when optional metadata is absent", async () => {
    const result = await uploadPackAsset(
      { accountId: "owner" },
      {
        file: {
          download_url: "https://files.example/selected?signature=fixture",
          file_id: "file-selected",
        },
      },
    );
    expect(fetchPackMedia).toHaveBeenCalledWith("https://files.example/selected?signature=fixture");
    expect(storePackFile).toHaveBeenCalledWith("owner", expect.any(Buffer), "audio/mpeg");
    expect(result.content_type).toBe("audio/mpeg");
  });
  it("rejects conflicting sources rather than looking at unrelated files", async () => {
    await expect(
      uploadPackAsset(
        { accountId: "owner" },
        {
          source_url: "https://example.com/other.mp3",
          file: { download_url: "https://files.example/selected", file_id: "selected" },
        },
      ),
    ).rejects.toThrow("exactly one");
  });
});
