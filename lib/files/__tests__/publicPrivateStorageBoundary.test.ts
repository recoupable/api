import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadPublicFileByKey } from "@/lib/supabase/storage/uploadPublicFileByKey";
import { uploadFileByKey } from "@/lib/supabase/storage/uploadFileByKey";
const storage = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", () => ({ default: { storage: { from: storage.from } } }));
describe("storage visibility boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.from.mockReturnValue({ upload: storage.upload });
    storage.upload.mockResolvedValue({ error: null });
  });
  it("writes public assets with uploader metadata to public-uploads only", async () => {
    const blob = new Blob(["hello"]);
    await uploadPublicFileByKey("owner/key", blob, {
      contentType: "text/plain",
      metadata: { uploaded_by: "owner" },
    });
    expect(storage.from).toHaveBeenCalledWith("public-uploads");
    expect(storage.upload).toHaveBeenCalledWith("owner/key", blob, {
      contentType: "text/plain",
      upsert: false,
      metadata: { uploaded_by: "owner" },
    });
  });
  it("keeps the existing private Files/audio helper in user-files", async () => {
    const blob = new Blob(["private"]);
    await uploadFileByKey("files/owner/artist/audio", blob, { contentType: "audio/wav" });
    expect(storage.from).toHaveBeenCalledWith("user-files");
    expect(storage.upload).toHaveBeenCalledWith("files/owner/artist/audio", blob, {
      contentType: "audio/wav",
      upsert: false,
    });
  });
});
