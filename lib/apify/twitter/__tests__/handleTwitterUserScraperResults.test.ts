import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleTwitterUserScraperResults } from "@/lib/apify/twitter/handleTwitterUserScraperResults";

const listItems = vi.fn();
const getRecord = vi.fn();
vi.mock("@/lib/apify/client", () => ({
  default: {
    dataset: vi.fn(() => ({ listItems })),
    keyValueStore: vi.fn(() => ({ getRecord })),
  },
}));
const upsertSocials = vi.fn();
vi.mock("@/lib/supabase/socials/upsertSocials", () => ({
  upsertSocials: (...a: unknown[]) => upsertSocials(...a),
}));

const payload = {
  eventData: { actorId: "V38PZzpEgOfeeWvZY" },
  resource: { defaultDatasetId: "ds-u1", defaultKeyValueStoreId: "kv-u1" },
} as never;

// Real shape from a live apidojo~twitter-user-scraper run (2026-07-06,
// twitterHandles: ["ashnikko"]): the actor returns the requested user AND
// pads with related users, so the handler must filter by the requested handle.
const REQUESTED_USER = {
  type: "user",
  userName: "ashnikko",
  url: "https://x.com/ashnikko",
  profilePicture: "https://pbs.twimg.com/profile_images/ash.jpg",
  description: "smoochies out now",
  location: "London",
  followers: 239289,
  following: 500,
};
const RELATED_PADDING_USER = {
  type: "user",
  userName: "infoashnikko",
  url: "https://x.com/infoashnikko",
  followers: 3053,
  following: 12,
};

beforeEach(() => {
  vi.clearAllMocks();
  upsertSocials.mockResolvedValue([]);
  getRecord.mockResolvedValue({
    key: "INPUT",
    value: { twitterHandles: ["Ashnikko"], maxItems: 1 },
  });
});

describe("handleTwitterUserScraperResults", () => {
  it("upserts only the requested handle's profile with a LOWERCASED x.com profile_url", async () => {
    listItems.mockResolvedValue({ items: [RELATED_PADDING_USER, REQUESTED_USER] });
    const result = await handleTwitterUserScraperResults(payload);
    expect(upsertSocials).toHaveBeenCalledWith([
      {
        profile_url: "x.com/ashnikko",
        username: "ashnikko",
        avatar: "https://pbs.twimg.com/profile_images/ash.jpg",
        bio: "smoochies out now",
        followerCount: 239289,
        followingCount: 500,
        region: "London",
      },
    ]);
    expect(result).toEqual({ social: expect.objectContaining({ profile_url: "x.com/ashnikko" }) });
  });

  it("returns social null and does not upsert when the requested handle is absent from items", async () => {
    listItems.mockResolvedValue({ items: [RELATED_PADDING_USER] });
    const result = await handleTwitterUserScraperResults(payload);
    expect(upsertSocials).not.toHaveBeenCalled();
    expect(result).toEqual({ social: null });
  });

  it("returns social null when the INPUT record is unavailable", async () => {
    getRecord.mockResolvedValue(undefined);
    listItems.mockResolvedValue({ items: [REQUESTED_USER] });
    const result = await handleTwitterUserScraperResults(payload);
    expect(upsertSocials).not.toHaveBeenCalled();
    expect(result).toEqual({ social: null });
  });
});
