import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadConnectorFile } from "../uploadConnectorFile";
import { getComposioClient } from "../../client";

vi.mock("../../client", () => ({
  getComposioClient: vi.fn(),
}));

describe("uploadConnectorFile", () => {
  const upload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getComposioClient).mockResolvedValue({
      files: { upload },
    } as unknown as Awaited<ReturnType<typeof getComposioClient>>);
  });

  it("uploads the url scoped to the tool/toolkit and returns the flat descriptor", async () => {
    upload.mockResolvedValue({
      name: "post.png",
      mimetype: "image/png",
      s3key: "composio/abc123",
    });

    const result = await uploadConnectorFile({
      url: "https://cdn.example.com/post.png",
      toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST",
    });

    expect(upload).toHaveBeenCalledWith({
      file: "https://cdn.example.com/post.png",
      toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST",
      toolkitSlug: "linkedin",
    });
    expect(result).toEqual({
      name: "post.png",
      mimetype: "image/png",
      s3key: "composio/abc123",
    });
  });

  it("propagates upstream upload failures", async () => {
    upload.mockRejectedValue(new Error("storage returned HTTP 404"));
    await expect(
      uploadConnectorFile({
        url: "https://cdn.example.com/post.png",
        toolSlug: "LINKEDIN_CREATE_LINKED_IN_POST",
      }),
    ).rejects.toThrow("storage returned HTTP 404");
  });
});
