import { describe, it, expect } from "vitest";
import { getFormattedArtist } from "@/lib/artists/getFormattedArtist";

const row = {
  artist_info: {
    id: "acct-ebae",
    name: "Apache",
    account_info: [
      {
        id: "info-33ad",
        image: "img",
        instruction: null,
        knowledges: [],
        label: "artist",
        job_title: "CEO",
        role_type: "manager",
        company_name: "OneRPM",
        organization: "org",
      },
    ],
    account_socials: [],
  },
} as never;

describe("getFormattedArtist", () => {
  it("returns id === account_id (never the account_info.id) so sub-resources resolve", () => {
    const a = getFormattedArtist(row);
    expect(a.account_id).toBe("acct-ebae");
    expect(a.id).toBe("acct-ebae"); // NOT "info-33ad" — /artists/{id}/socials keys on account_id
  });

  it("does not leak raw account_info fields (job_title/role_type/company_name/organization)", () => {
    const a = getFormattedArtist(row) as Record<string, unknown>;
    for (const k of ["job_title", "role_type", "company_name", "organization"]) {
      expect(a[k]).toBeUndefined();
    }
  });
});
