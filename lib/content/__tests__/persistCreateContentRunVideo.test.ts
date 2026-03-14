import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistCreateContentRunVideo } from "@/lib/content/persistCreateContentRunVideo";
import { CREATE_CONTENT_TASK_ID } from "@/lib/const";
import { selectFileByStorageKey } from "@/lib/supabase/files/selectFileByStorageKey";
import { uploadFileByKey } from "@/lib/supabase/storage/uploadFileByKey";
import { createFileRecord } from "@/lib/supabase/files/createFileRecord";
import { createSignedFileUrlByKey } from "@/lib/supabase/storage/createSignedFileUrlByKey";

vi.mock("@/lib/supabase/files/selectFileByStorageKey", () => ({
  selectFileByStorageKey: vi.fn(),
}));

vi.mock("@/lib/supabase/storage/uploadFileByKey", () => ({
  uploadFileByKey: vi.fn(),
}));

vi.mock("@/lib/supabase/files/createFileRecord", () => ({
  createFileRecord: vi.fn(),
}));

vi.mock("@/lib/supabase/storage/createSignedFileUrlByKey", () => ({
  createSignedFileUrlByKey: vi.fn(),
}));

describe("persistCreateContentRunVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSignedFileUrlByKey).mockResolvedValue("https://example.com/signed.mp4");
  });

  it("returns run unchanged when task is not create-content", async () => {
    const run = { id: "run_1", taskIdentifier: "other-task", status: "COMPLETED", output: {} };
    const result = await persistCreateContentRunVideo(run);
    expect(result).toEqual(run);
  });

  it("hydrates from existing file without uploading", async () => {
    vi.mocked(selectFileByStorageKey).mockResolvedValue({
      id: "file_1",
      owner_account_id: "acc_1",
      artist_account_id: "acc_1",
      storage_key: "content/acc_1/artist/run_1.mp4",
      file_name: "artist-run_1.mp4",
      mime_type: "video/mp4",
      size_bytes: 100,
      description: null,
      tags: [],
    });

    const run = {
      id: "run_1",
      taskIdentifier: CREATE_CONTENT_TASK_ID,
      status: "COMPLETED",
      output: {
        accountId: "acc_1",
        artistSlug: "artist",
        template: "artist-caption-bedroom",
        lipsync: false,
        videoSourceUrl: "https://example.com/video.mp4",
      },
    };
    const result = await persistCreateContentRunVideo(run);

    expect(uploadFileByKey).not.toHaveBeenCalled();
    expect(createFileRecord).not.toHaveBeenCalled();
    expect((result.output as { video?: { fileId: string; signedUrl: string } }).video?.fileId).toBe(
      "file_1",
    );
    expect(
      (result.output as { video?: { fileId: string; signedUrl: string } }).video?.signedUrl,
    ).toBe("https://example.com/signed.mp4");
  });

  it("downloads and persists video when file does not exist", async () => {
    vi.mocked(selectFileByStorageKey).mockResolvedValue(null);
    vi.mocked(createFileRecord).mockResolvedValue({
      id: "file_2",
      owner_account_id: "acc_1",
      artist_account_id: "acc_1",
      storage_key: "content/acc_1/artist/artist-run_2.mp4",
      file_name: "artist-run_2.mp4",
      mime_type: "video/mp4",
      size_bytes: 100,
      description: null,
      tags: [],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "video/mp4" }),
        blob: async () => new Blob(["video-bytes"], { type: "video/mp4" }),
      }),
    );

    const run = {
      id: "run_2",
      taskIdentifier: CREATE_CONTENT_TASK_ID,
      status: "COMPLETED",
      output: {
        accountId: "acc_1",
        artistSlug: "artist",
        template: "artist-caption-bedroom",
        lipsync: false,
        videoSourceUrl: "https://example.com/video.mp4",
      },
    };
    const result = await persistCreateContentRunVideo(run);

    expect(uploadFileByKey).toHaveBeenCalledOnce();
    expect(createFileRecord).toHaveBeenCalledOnce();
    expect((result.output as { video?: { fileId: string; signedUrl: string } }).video?.fileId).toBe(
      "file_2",
    );
    expect(
      (result.output as { video?: { fileId: string; signedUrl: string } }).video?.signedUrl,
    ).toBe("https://example.com/signed.mp4");
  });

  it("throws when upload fails", async () => {
    vi.mocked(selectFileByStorageKey).mockResolvedValue(null);
    vi.mocked(uploadFileByKey).mockRejectedValue(new Error("upload failed"));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "video/mp4" }),
        blob: async () => new Blob(["video-bytes"], { type: "video/mp4" }),
      }),
    );

    const run = {
      id: "run_3",
      taskIdentifier: CREATE_CONTENT_TASK_ID,
      status: "COMPLETED",
      output: {
        accountId: "acc_1",
        artistSlug: "artist",
        template: "artist-caption-bedroom",
        lipsync: false,
        videoSourceUrl: "https://example.com/video.mp4",
      },
    };

    await expect(persistCreateContentRunVideo(run)).rejects.toThrow("upload failed");
    expect(createFileRecord).not.toHaveBeenCalled();
  });

  it("throws when file record creation fails", async () => {
    vi.mocked(selectFileByStorageKey).mockResolvedValue(null);
    vi.mocked(uploadFileByKey).mockResolvedValue(undefined);
    vi.mocked(createFileRecord).mockRejectedValue(new Error("create file record failed"));

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "video/mp4" }),
        blob: async () => new Blob(["video-bytes"], { type: "video/mp4" }),
      }),
    );

    const run = {
      id: "run_4",
      taskIdentifier: CREATE_CONTENT_TASK_ID,
      status: "COMPLETED",
      output: {
        accountId: "acc_1",
        artistSlug: "artist",
        template: "artist-caption-bedroom",
        lipsync: false,
        videoSourceUrl: "https://example.com/video.mp4",
      },
    };

    await expect(persistCreateContentRunVideo(run)).rejects.toThrow(
      "Failed to create or find file record",
    );
  });
});
