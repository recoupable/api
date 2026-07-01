import { describe, it, expect, vi, beforeEach } from "vitest";

import { handleLinkedinProfileScraperResults } from "@/lib/apify/linkedin/handleLinkedinProfileScraperResults";

const listItems = vi.fn();
vi.mock("@/lib/apify/client", () => ({
  default: { dataset: vi.fn(() => ({ listItems })) },
}));
const upsertSocials = vi.fn();
vi.mock("@/lib/supabase/socials/upsertSocials", () => ({
  upsertSocials: (...a: unknown[]) => upsertSocials(...a),
}));

const payload = {
  eventData: { actorId: "LpVuK3Zozwuipa5bp" },
  resource: { defaultDatasetId: "ds-li-1" },
} as never;

// Trimmed from a real harvestapi run (TNwgXpQmhvoCHsKg8, 2026-07-01).
const REAL_PROFILE = {
  publicIdentifier: "sweetmaneth",
  linkedinUrl: "https://www.linkedin.com/in/sweetmaneth",
  firstName: "sweetman",
  lastName: "eth",
  headline: "The dev for onchain music.",
  about: "I am the builder. I code, architect, and scale the system. I build products to last.",
  followerCount: 13203,
  connectionsCount: 14242,
  photo: "https://media.licdn.com/dms/image/v2/C4D03AQEVoqkcw2x3HA/photo.jpg",
  location: { linkedinText: "Columbus, Ohio, United States", countryCode: "US" },
};

beforeEach(() => {
  vi.clearAllMocks();
  upsertSocials.mockResolvedValue([]);
});

describe("handleLinkedinProfileScraperResults", () => {
  it("upserts the socials row from a real harvestapi profile item (keyed on profile_url)", async () => {
    listItems.mockResolvedValue({ items: [REAL_PROFILE] });
    const result = await handleLinkedinProfileScraperResults(payload);

    expect(upsertSocials).toHaveBeenCalledWith([
      {
        profile_url: "linkedin.com/in/sweetmaneth",
        username: "sweetmaneth",
        avatar: "https://media.licdn.com/dms/image/v2/C4D03AQEVoqkcw2x3HA/photo.jpg",
        bio: "I am the builder. I code, architect, and scale the system. I build products to last.",
        followerCount: 13203,
        region: "Columbus, Ohio, United States",
      },
    ]);
    expect(result).toMatchObject({ social: expect.anything() });
  });

  it("skips 404 wrapper items (harvestapi returns {element:{}, error, status} for missing profiles)", async () => {
    // Real shape from run AB81HuE3atfKvhIKh (linkedin.com/in/in → 404).
    listItems.mockResolvedValue({
      items: [{ element: {}, error: "Profile not found", status: 404, query: {} }],
    });
    const result = await handleLinkedinProfileScraperResults(payload);
    expect(upsertSocials).not.toHaveBeenCalled();
    expect(result).toEqual({ social: null });
  });

  it("no-ops on an empty dataset", async () => {
    listItems.mockResolvedValue({ items: [] });
    const result = await handleLinkedinProfileScraperResults(payload);
    expect(upsertSocials).not.toHaveBeenCalled();
    expect(result).toEqual({ social: null });
  });
});
