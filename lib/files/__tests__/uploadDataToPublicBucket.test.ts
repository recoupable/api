import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadDataToPublicBucket } from "@/lib/files/uploadDataToPublicBucket";
import { uploadFileByKey } from "@/lib/supabase/storage/uploadFileByKey";
import { getPublicUrlByKey } from "@/lib/supabase/storage/getPublicUrlByKey";
import { SUPABASE_PUBLIC_UPLOADS_BUCKET } from "@/lib/const";

vi.mock("@/lib/supabase/storage/uploadFileByKey", () => ({
  uploadFileByKey: vi.fn(),
}));

vi.mock("@/lib/supabase/storage/getPublicUrlByKey", () => ({
  getPublicUrlByKey: vi.fn(),
}));

describe("uploadDataToPublicBucket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPublicUrlByKey).mockReturnValue(
      "https://example.supabase.co/storage/v1/object/public/public-uploads/abc.png",
    );
  });

  it("uploads at the bucket root with a uuid + extension key and returns the public URL", async () => {
    const result = await uploadDataToPublicBucket({
      data: Buffer.from([1, 2, 3]),
      contentType: "image/png",
      fileExtension: ".png",
    });

    expect(uploadFileByKey).toHaveBeenCalledTimes(1);
    const [keyArg, blobArg, optionsArg] = vi.mocked(uploadFileByKey).mock.calls[0];
    expect(keyArg).toMatch(/^[0-9a-f-]{36}\.png$/i);
    expect(keyArg).not.toContain("/");
    expect(blobArg).toBeInstanceOf(Blob);
    expect(optionsArg).toMatchObject({
      bucket: SUPABASE_PUBLIC_UPLOADS_BUCKET,
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: false,
    });
    expect(getPublicUrlByKey).toHaveBeenCalledWith(keyArg, SUPABASE_PUBLIC_UPLOADS_BUCKET);
    expect(result.key).toBe(keyArg);
    expect(result.url).toBe(
      "https://example.supabase.co/storage/v1/object/public/public-uploads/abc.png",
    );
  });

  it("normalizes a fileExtension that lacks the leading dot", async () => {
    await uploadDataToPublicBucket({
      data: "hello",
      contentType: "text/plain",
      fileExtension: "txt",
    });

    const [keyArg] = vi.mocked(uploadFileByKey).mock.calls[0];
    expect(keyArg).toMatch(/^[0-9a-f-]{36}\.txt$/i);
  });

  it("accepts a string body", async () => {
    await uploadDataToPublicBucket({
      data: "{}",
      contentType: "application/json",
      fileExtension: ".json",
    });
    const [, blobArg] = vi.mocked(uploadFileByKey).mock.calls[0];
    expect(blobArg).toBeInstanceOf(Blob);
  });
});
