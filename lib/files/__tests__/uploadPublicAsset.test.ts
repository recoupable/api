import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadPublicAsset } from "@/lib/files/uploadPublicAsset";
import { uploadFileByKey } from "@/lib/supabase/storage/uploadFileByKey";
import { getPublicUrlByKey } from "@/lib/supabase/storage/getPublicUrlByKey";
import { SUPABASE_PUBLIC_UPLOADS_BUCKET } from "@/lib/const";

vi.mock("@/lib/supabase/storage/uploadFileByKey", () => ({
  uploadFileByKey: vi.fn(),
}));

vi.mock("@/lib/supabase/storage/getPublicUrlByKey", () => ({
  getPublicUrlByKey: vi.fn(),
}));

describe("uploadPublicAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicUrlByKey).mockReturnValue(
      "https://example.supabase.co/storage/v1/object/public/public-uploads/abc",
    );
  });

  it("uploads at the bucket root with a uuid key and returns the public URL", async () => {
    const result = await uploadPublicAsset({
      data: Buffer.from([1, 2, 3]),
      contentType: "image/png",
    });

    expect(uploadFileByKey).toHaveBeenCalledTimes(1);
    const [keyArg, blobArg, optionsArg] = vi.mocked(uploadFileByKey).mock.calls[0];
    expect(keyArg).toMatch(/^[0-9a-f-]{36}$/i);
    expect(keyArg).not.toContain("/");
    expect(keyArg).not.toContain(".");
    expect(blobArg).toBeInstanceOf(Blob);
    expect(optionsArg).toMatchObject({
      bucket: SUPABASE_PUBLIC_UPLOADS_BUCKET,
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: false,
    });
    expect(getPublicUrlByKey).toHaveBeenCalledWith(keyArg, SUPABASE_PUBLIC_UPLOADS_BUCKET);
    expect(result.id).toBe(keyArg);
    expect(result.url).toBe(
      "https://example.supabase.co/storage/v1/object/public/public-uploads/abc",
    );
  });

  it("accepts a string body", async () => {
    await uploadPublicAsset({
      data: "{}",
      contentType: "application/json",
    });
    const [, blobArg] = vi.mocked(uploadFileByKey).mock.calls[0];
    expect(blobArg).toBeInstanceOf(Blob);
  });
});
