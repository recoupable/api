import Ajv from "ajv";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/artists/[id]/fans/route";
import fixture from "../fixtures/published-docs.json";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  accounts: vi.fn(),
  access: vi.fn(),
  socials: vi.fn(),
  fans: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: mocks.auth }));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({ selectAccounts: mocks.accounts }));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: mocks.access,
}));
vi.mock("@/lib/supabase/account_socials/selectAccountSocialIds", () => ({
  selectAccountSocialIds: mocks.socials,
}));
vi.mock("@/lib/supabase/social_fans/selectSocialFans", () => ({ selectSocialFans: mocks.fans }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));

const artist = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ accountId: "account_fixture" });
  mocks.accounts.mockResolvedValue([{ id: artist }]);
  mocks.access.mockResolvedValue(true);
  mocks.socials.mockResolvedValue(["artist_social_fixture"]);
});

it("publishes an optional nullable comment date without changing the existing profile date", () => {
  expect(fixture.artistFans).toBeDefined();
  const fan = fixture.artistFans.schema.properties.fans.items;
  expect(fan.properties.last_comment_at).toMatchObject({
    type: "string",
    nullable: true,
    format: "date-time",
  });
  expect(fan.required ?? []).not.toContain("last_comment_at");
  expect(fan.properties.updated_at.format).toBe("date-time");
});

it.each(["missing", "mismatched", "array"])(
  "matches the published known/unknown response through the actual route with %s evidence",
  async evidence => {
    expect(fixture.artistFans).toBeDefined();
    const { example, schema } = fixture.artistFans;
    const [known, unknown] = example.fans;
    const comment = { social_id: known.id, commented_at: known.last_comment_at };
    mocks.fans.mockResolvedValue({
      rows: [
        {
          fan_social:
            evidence === "array"
              ? [{ id: known.id, username: known.username }]
              : { id: known.id, username: known.username },
          latest_engagement_comment: evidence === "array" ? [comment] : comment,
        },
        {
          fan_social: { id: unknown.id, username: unknown.username },
          latest_engagement_comment: evidence === "mismatched" ? comment : null,
          latest_engagement: "2099-01-01T00:00:00Z",
        },
      ],
      totalCount: 2,
    });
    const response = await GET(
      new NextRequest(`https://example.invalid/api/artists/${artist}/fans`),
      {
        params: Promise.resolve({ id: artist }),
      },
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual(example);
    const validate = new Ajv({ allErrors: true, strict: false, validateFormats: false }).compile(
      schema,
    );
    expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...body, fans: [{ ...known, last_comment_at: 123 }] })).toBe(false);
    expect(mocks.access).toHaveBeenCalledWith("account_fixture", artist);
    expect(mocks.fans).toHaveBeenCalledWith(
      expect.objectContaining({ social_ids: ["artist_social_fixture"] }),
    );
  },
);
