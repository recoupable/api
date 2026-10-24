import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { getFormattedArtist, type ArtistQueryRow } from "@/lib/artists/getFormattedArtist";
import fixture from "../fixtures/published-docs.json";

type SocialJoin = NonNullable<ArtistQueryRow["account_socials"]>[number];
interface SocialContract {
  method: string;
  path: string;
  status: number;
  schema: {
    type: string;
    items: { properties: Record<string, unknown> };
  };
}
const published = fixture as unknown as {
  artistSocials: {
    example: Record<string, unknown> | null;
    responses: Record<"list" | "update", SocialContract>;
  };
};
const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });
const profile: NonNullable<SocialJoin["social"]> = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "river",
  profile_url: "https://instagram.com/river",
  avatar: null,
  bio: null,
  followerCount: null,
  followingCount: null,
  region: null,
  updated_at: "2026-10-22T00:00:00Z",
};

function join(social: SocialJoin["social"]): SocialJoin {
  return {
    id: "fixture-join",
    account_id: "fixture-artist",
    social_id: social?.id ?? "fixture-missing",
    social,
  };
}

describe.each(["list", "update"] as const)("published artist %s socials", operation => {
  it("declares the actual formatter fields instead of a nonexistent platform field", () => {
    const contract = published.artistSocials.responses[operation];
    expect(contract).toMatchObject(
      operation === "list"
        ? { method: "GET", path: "/api/artists", status: 200 }
        : { method: "PATCH", path: "/api/artists/{id}", status: 200 },
    );
    expect(contract.schema.type).toBe("array");
    const fields = contract.schema.items.properties;
    for (const name of ["id", "username", "profile_url", "link", "type"])
      expect(fields[name], `Missing documented social field: ${name}`).toBeDefined();
    expect(fields.platform).toBeUndefined();
    expect(fields.link).toMatchObject({ type: "string" });
    expect(fields.type).toMatchObject({ type: "string" });
  });

  it("accepts real formatted profiles and preserves empty URLs while omitting null joins", () => {
    const row: ArtistQueryRow = {
      id: "fixture-artist",
      account_socials: [join(null), join(profile), join({ ...profile, profile_url: "" })],
    };
    const before = structuredClone(row);
    const { account_socials } = getFormattedArtist(row);
    expect(account_socials).toEqual([
      { ...profile, link: profile.profile_url, type: "INSTAGRAM" },
      { ...profile, profile_url: "", link: "", type: "NONE" },
    ]);
    const validate = ajv.compile(published.artistSocials.responses[operation].schema);
    expect(validate(account_socials), JSON.stringify(validate.errors)).toBe(true);
    expect(validate([{ ...profile, link: 123 }])).toBe(false);
    expect(validate([{ ...profile, type: 123 }])).toBe(false);
    expect(row).toEqual(before);
  });

  it("accepts an empty list when there are no existing joined profiles", () => {
    const validate = ajv.compile(published.artistSocials.responses[operation].schema);
    expect(getFormattedArtist({ account_socials: [join(null)] }).account_socials).toEqual([]);
    expect(validate([])).toBe(true);
  });
});

it("keeps the copyable list-profile example consistent with the actual formatter", () => {
  const { example } = published.artistSocials;
  expect(example).not.toBeNull();
  const [social] = getFormattedArtist({ account_socials: [join(profile)] }).account_socials;
  expect(social).toMatchObject(example!);
  expect(Object.keys(example!).sort()).toEqual(["id", "link", "profile_url", "type", "username"]);
  const validate = ajv.compile(published.artistSocials.responses.list.schema);
  expect(validate([example])).toBe(true);
});
