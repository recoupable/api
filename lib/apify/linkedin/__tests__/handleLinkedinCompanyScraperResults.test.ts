import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleLinkedinCompanyScraperResults } from "@/lib/apify/linkedin/handleLinkedinCompanyScraperResults";

const listItems = vi.fn();
vi.mock("@/lib/apify/client", () => ({
  default: { dataset: vi.fn(() => ({ listItems })) },
}));
const upsertSocialsWithSnapshot = vi.fn();
vi.mock("@/lib/socials/upsertSocialsWithSnapshot", () => ({
  upsertSocialsWithSnapshot: (...a: unknown[]) => upsertSocialsWithSnapshot(...a),
}));

const payload = {
  eventData: { actorId: "UwSdACBp7ymaGUJjS" },
  resource: { defaultDatasetId: "ds-co-1" },
} as never;

// Shape from the harvestapi/linkedin-company README sample output.
const COMPANY = {
  id: "165158",
  universalName: "recoupable",
  linkedinUrl: "https://www.linkedin.com/company/recoupable",
  name: "Recoupable",
  tagline: "AI for music teams",
  description: "Recoupable builds AI agents for music teams.",
  logo: "https://media.licdn.com/dms/image/v2/logo.jpg",
  followerCount: 1234,
};

beforeEach(() => {
  vi.clearAllMocks();
  upsertSocialsWithSnapshot.mockResolvedValue([]);
});

describe("handleLinkedinCompanyScraperResults", () => {
  it("upserts the company page row keyed on its /company/ profile_url", async () => {
    listItems.mockResolvedValue({ items: [COMPANY] });
    const result = await handleLinkedinCompanyScraperResults(payload);
    expect(upsertSocialsWithSnapshot).toHaveBeenCalledWith([
      {
        profile_url: "linkedin.com/company/recoupable",
        username: "recoupable",
        avatar: "https://media.licdn.com/dms/image/v2/logo.jpg",
        bio: "Recoupable builds AI agents for music teams.",
        followerCount: 1234,
      },
    ]);
    expect(result).toMatchObject({ social: expect.anything() });
  });

  it("falls back to the tagline when there is no description", async () => {
    listItems.mockResolvedValue({ items: [{ ...COMPANY, description: undefined }] });
    await handleLinkedinCompanyScraperResults(payload);
    expect(upsertSocialsWithSnapshot).toHaveBeenCalledWith([
      expect.objectContaining({ bio: "AI for music teams" }),
    ]);
  });

  it.each([[[]], [[{ error: "Company not found", status: 404 }]]])(
    "persists nothing for an empty or error dataset: %j",
    async items => {
      listItems.mockResolvedValue({ items });
      expect(await handleLinkedinCompanyScraperResults(payload)).toEqual({ social: null });
      expect(upsertSocialsWithSnapshot).not.toHaveBeenCalled();
    },
  );
});
