import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishInstagram } from "../publish/publishInstagram";
import { publishX } from "../publish/publishX";
import { publishYouTube } from "../publish/publishYouTube";
import { publishLinkedIn } from "../publish/publishLinkedIn";
import { executePostAction } from "../executePostAction";
import { proxyLinkedIn } from "../proxyLinkedIn";
import { uploadConnectorFile } from "@/lib/composio/connectors/uploadConnectorFile";

vi.mock("../executePostAction", () => ({ executePostAction: vi.fn() }));
vi.mock("../proxyLinkedIn", () => ({ proxyLinkedIn: vi.fn() }));
vi.mock("@/lib/composio/connectors/uploadConnectorFile", () => ({ uploadConnectorFile: vi.fn() }));

const target = { accountId: "acct", connectedAccountId: "ca_1" };
const base = {
  id: "p1",
  account_id: "acct",
  video_url: "https://cdn.example.test/clip.mp4",
  cover_url: null,
  title: null,
  description: null,
  privacy: null,
  tags: null,
  sub_account_id: null,
};
const file = { name: "clip.mp4", mimetype: "video/mp4", s3key: "k" };

/** Route executePostAction by slug. */
function actions(map: Record<string, unknown>) {
  vi.mocked(executePostAction).mockImplementation(async (_t, slug) => {
    const value = map[slug];
    if (value instanceof Error) throw value;
    return (value ?? {}) as Record<string, unknown>;
  });
}

describe("platform publishers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadConnectorFile).mockResolvedValue(file);
  });

  it("instagram: container with cover, publish, permalink, caption check", async () => {
    actions({
      INSTAGRAM_GET_USER_INFO: { data: { id: "ig1" } },
      INSTAGRAM_POST_IG_USER_MEDIA: { data: { id: "c1" } },
      INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH: { data: { id: "m1" } },
      INSTAGRAM_GET_IG_MEDIA: {
        data: { permalink: "https://www.instagram.com/reel/abc/", caption: "Caption" },
      },
    });
    const post = {
      ...base,
      platform: "instagram",
      description: "Caption",
      cover_url: "https://c/cover.jpg",
    };
    const result = await publishInstagram({ target, post } as never);
    expect(result).toEqual({ postUrl: "https://www.instagram.com/reel/abc/", textVerified: true });
    expect(executePostAction).toHaveBeenCalledWith(
      target,
      "INSTAGRAM_POST_IG_USER_MEDIA",
      expect.objectContaining({
        ig_user_id: "ig1",
        media_type: "REELS",
        caption: "Caption",
        cover_url: "https://c/cover.jpg",
      }),
    );
  });

  it("x: retries the media upload, posts with media_media_ids, ignores the t.co suffix", async () => {
    vi.useFakeTimers();
    let uploads = 0;
    vi.mocked(executePostAction).mockImplementation(async (_t, slug) => {
      if (slug === "TWITTER_UPLOAD_LARGE_MEDIA")
        return ++uploads < 2 ? {} : { data: { media_id_string: "md1" } };
      if (slug === "TWITTER_CREATION_OF_A_POST") return { data: { id: "t1" } };
      return { data: { data: [{ text: "Drake & Wayne https://t.co/xyz" }] } } as never;
    });
    const pending = publishX({
      target,
      post: { ...base, platform: "x", description: "Drake & Wayne" },
    } as never);
    await vi.runAllTimersAsync();
    const result = await pending;
    vi.useRealTimers();
    expect(uploads).toBe(2);
    expect(executePostAction).toHaveBeenCalledWith(target, "TWITTER_CREATION_OF_A_POST", {
      text: "Drake & Wayne",
      media_media_ids: ["md1"],
    });
    expect(result.postUrl).toBe("https://x.com/i/status/t1");
  });

  it("youtube: uploads unlisted, sets privacy after, no thumbnail call, checks snippet", async () => {
    actions({
      YOUTUBE_MULTIPART_UPLOAD_VIDEO: { data: { video: { id: "v1" } } },
      YOUTUBE_GET_VIDEO_DETAILS_BATCH: {
        data: { items: [{ snippet: { title: "Title", description: "Desc" } }] },
      },
    });
    const post = {
      ...base,
      platform: "youtube",
      title: "Title",
      description: "Desc",
      tags: ["music"],
    };
    const result = await publishYouTube({ target, post } as never);
    expect(result).toEqual({ postUrl: "https://www.youtube.com/watch?v=v1", textVerified: true });
    const slugs = vi.mocked(executePostAction).mock.calls.map(call => call[1]);
    expect(slugs).not.toContain("YOUTUBE_UPDATE_THUMBNAIL");
    expect(executePostAction).toHaveBeenCalledWith(
      target,
      "YOUTUBE_MULTIPART_UPLOAD_VIDEO",
      expect.objectContaining({ privacyStatus: "unlisted", tags: ["music"] }),
    );
    expect(executePostAction).toHaveBeenCalledWith(
      target,
      "YOUTUBE_UPDATE_VIDEO",
      expect.objectContaining({ videoId: "v1", privacyStatus: "public" }),
    );
  });

  it("youtube: a quota error propagates for the workflow to record", async () => {
    actions({
      YOUTUBE_MULTIPART_UPLOAD_VIDEO: new Error(
        "YOUTUBE_MULTIPART_UPLOAD_VIDEO failed: quotaExceeded",
      ),
    });
    await expect(
      publishYouTube({ target, post: { ...base, platform: "youtube", title: "T" } } as never),
    ).rejects.toThrow("quotaExceeded");
  });

  it("linkedin: posts as the Page in sub_account_id with escaped commentary", async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array(10), { status: 200, headers: { etag: "e1" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(proxyLinkedIn).mockImplementation(async (_c, method, endpoint) => {
      if (endpoint.includes("initializeUpload")) {
        return {
          data: {
            value: {
              video: "urn:li:video:1",
              uploadToken: "",
              uploadInstructions: [{ uploadUrl: "https://up/1", firstByte: 0, lastByte: 9 }],
            },
          },
          headers: {},
        };
      }
      if (endpoint.includes("/videos/")) return { data: { status: "AVAILABLE" }, headers: {} };
      if (method === "POST" && endpoint.endsWith("/posts"))
        return { data: {}, headers: { "x-restli-id": "urn:li:share:9" } };
      if (method === "GET" && endpoint.includes("/posts/"))
        return { data: { commentary: "Rights {hashtag|\\#|music}" }, headers: {} };
      return { data: {}, headers: {} };
    });
    const post = {
      ...base,
      platform: "linkedin",
      description: "Rights #music",
      sub_account_id: "urn:li:organization:101127186",
    };
    const result = await publishLinkedIn({ target, post } as never);
    vi.unstubAllGlobals();
    expect(result).toEqual({
      postUrl: "https://www.linkedin.com/feed/update/urn:li:share:9/",
      textVerified: true,
    });
    const created = vi
      .mocked(proxyLinkedIn)
      .mock.calls.find(([, m, e]) => m === "POST" && e.endsWith("/posts"));
    expect(created?.[3]).toMatchObject({
      author: "urn:li:organization:101127186",
      commentary: "Rights {hashtag|\\#|music}",
    });
    expect(vi.mocked(proxyLinkedIn).mock.calls.some(([, , e]) => e.includes("userinfo"))).toBe(
      false,
    );
  });
});
