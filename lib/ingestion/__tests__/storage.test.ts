import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readIngestionObject } from "@/lib/supabase/storage/readIngestionObject";
import { createIngestionObject } from "@/lib/supabase/storage/createIngestionObject";
const mocks = vi.hoisted(() => ({
  bucket: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/lib/supabase/serverClient", () => ({
  default: { storage: { getBucket: mocks.bucket, from: mocks.from } },
}));
describe("private artifact storage", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INGESTION_STORAGE_BUCKET", "recoup-ingestion");
    mocks.from.mockReturnValue({ download: mocks.download, upload: mocks.upload });
    mocks.bucket.mockResolvedValue({
      data: { public: false, file_size_limit: 16 * 1024 * 1024 },
      error: null,
    });
  });
  it("refuses public buckets before any data transfer", async () => {
    mocks.bucket.mockResolvedValue({ data: { public: true }, error: null });
    await expect(readIngestionObject("key")).rejects.toThrow();
    await expect(createIngestionObject("key", Buffer.from("private"))).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("distinguishes missing objects from denied or unavailable reads", async () => {
    mocks.download.mockResolvedValue({ error: { statusCode: "404" } });
    expect(await readIngestionObject("key")).toBeNull();
    for (const statusCode of ["403", "500"]) {
      mocks.download.mockResolvedValue({ error: { statusCode } });
      await expect(readIngestionObject("key")).rejects.toThrow();
    }
  });
  it("uses atomic create-only writes and accepts only conflicts as existing objects", async () => {
    mocks.upload.mockResolvedValue({ error: null });
    expect(await createIngestionObject("key", Buffer.from("data"))).toBe(true);
    expect(mocks.upload.mock.calls[0][2].upsert).toBe(false);
    mocks.upload.mockResolvedValue({ error: { statusCode: "409" } });
    expect(await createIngestionObject("key", Buffer.from("data"))).toBe(false);
    mocks.upload.mockResolvedValue({ error: { statusCode: "403" } });
    await expect(createIngestionObject("key", Buffer.from("data"))).rejects.toThrow();
  });
});
