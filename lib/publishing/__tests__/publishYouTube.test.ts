import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishYouTube } from "../publish/publishYouTube";
import { executePostAction } from "../executePostAction";
import { uploadConnectorFile } from "@/lib/composio/connectors/uploadConnectorFile";

vi.mock("../executePostAction", () => ({ executePostAction: vi.fn() }));
vi.mock("@/lib/composio/connectors/uploadConnectorFile", () => ({ uploadConnectorFile: vi.fn() }));

const target = { accountId: "acct", connectedAccountId: "ca_1" };

describe("publishYouTube metadata update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadConnectorFile).mockResolvedValue({
      name: "c",
      mimetype: "video/mp4",
      s3key: "k",
    });
    vi.mocked(executePostAction).mockImplementation(async (_t, slug) =>
      slug === "YOUTUBE_MULTIPART_UPLOAD_VIDEO" ? { data: { video: { id: "v1" } } } : {},
    );
  });

  it("sends YOUTUBE_UPDATE_VIDEO snake_case keys, the only shape that keeps tags", async () => {
    await publishYouTube({
      target,
      post: {
        platform: "youtube",
        video_url: "https://cdn.example.test/clip.mp4",
        title: "Title",
        description: "Desc",
        privacy: "private",
        tags: ["music", "data"],
      },
    } as never);
    expect(executePostAction).toHaveBeenCalledWith(target, "YOUTUBE_UPDATE_VIDEO", {
      video_id: "v1",
      title: "Title",
      description: "Desc",
      category_id: "10",
      privacy_status: "private",
      tags: ["music", "data"],
    });
  });
});
