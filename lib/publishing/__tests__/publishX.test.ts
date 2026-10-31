import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishX } from "../publish/publishX";
import { executePostAction } from "../executePostAction";
import { uploadConnectorFile } from "@/lib/composio/connectors/uploadConnectorFile";

vi.mock("../executePostAction", () => ({ executePostAction: vi.fn() }));
vi.mock("@/lib/composio/connectors/uploadConnectorFile", () => ({ uploadConnectorFile: vi.fn() }));

const target = { accountId: "acct", connectedAccountId: "ca_1" };
const post = {
  id: "p1",
  account_id: "acct",
  platform: "x",
  video_url: "https://cdn.example.test/clip.mp4",
  description: "Drake & Wayne",
};

/** Route executePostAction by slug; an Error value is thrown. */
function actions(map: Record<string, unknown>) {
  vi.mocked(executePostAction).mockImplementation(async (_t, slug) => {
    const value = map[slug];
    if (value instanceof Error) throw value;
    return (value ?? {}) as Record<string, unknown>;
  });
}

describe("publishX read-back", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadConnectorFile).mockResolvedValue({
      name: "c",
      mimetype: "video/mp4",
      s3key: "k",
    });
  });

  it("reads the post back with the single-post lookup and verifies the text", async () => {
    actions({
      TWITTER_UPLOAD_LARGE_MEDIA: { data: { media_id_string: "md1" } },
      TWITTER_CREATION_OF_A_POST: { data: { id: "t1" } },
      TWITTER_POST_LOOKUP_BY_POST_ID: {
        data: { data: { text: "Drake &amp; Wayne https://t.co/xyz" } },
      },
    });
    const result = await publishX({ target, post } as never);
    expect(executePostAction).toHaveBeenCalledWith(target, "TWITTER_POST_LOOKUP_BY_POST_ID", {
      id: "t1",
    });
    expect(result).toEqual({ postUrl: "https://x.com/i/status/t1", textVerified: true });
  });

  it("a failed read-back still returns the post as live", async () => {
    actions({
      TWITTER_UPLOAD_LARGE_MEDIA: { data: { media_id_string: "md1" } },
      TWITTER_CREATION_OF_A_POST: { data: { id: "t1" } },
      TWITTER_POST_LOOKUP_BY_POST_ID: new Error("TWITTER_POST_LOOKUP_BY_POST_ID failed: 401"),
    });
    const result = await publishX({ target, post } as never);
    expect(result).toEqual({ postUrl: "https://x.com/i/status/t1", textVerified: false });
  });
});
