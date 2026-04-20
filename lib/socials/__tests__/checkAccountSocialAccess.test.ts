import { describe, it, expect, vi, beforeEach } from "vitest";

import { checkAccountSocialAccess } from "../checkAccountSocialAccess";
import { selectAccountSocialsBySocialId } from "@/lib/supabase/account_socials/selectAccountSocialsBySocialId";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";

vi.mock("@/lib/supabase/account_socials/selectAccountSocialsBySocialId", () => ({
  selectAccountSocialsBySocialId: vi.fn(),
}));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({
  checkAccountArtistAccess: vi.fn(),
}));

const ACCOUNT_ID = "770e8400-e29b-41d4-a716-446655440000";
const OWNER_ID = "660e8400-e29b-41d4-a716-446655440000";
const SOCIAL_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("checkAccountSocialAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the account directly owns the social", async () => {
    vi.mocked(selectAccountSocialsBySocialId).mockResolvedValue([
      { account_id: ACCOUNT_ID } as never,
    ]);
    expect(await checkAccountSocialAccess(ACCOUNT_ID, SOCIAL_ID)).toBe(true);
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns true when any owning account grants access via checkAccountArtistAccess", async () => {
    vi.mocked(selectAccountSocialsBySocialId).mockResolvedValue([
      { account_id: OWNER_ID } as never,
    ]);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
    expect(await checkAccountSocialAccess(ACCOUNT_ID, SOCIAL_ID)).toBe(true);
    expect(checkAccountArtistAccess).toHaveBeenCalledWith(ACCOUNT_ID, OWNER_ID);
  });

  it("returns false when social has no owning accounts", async () => {
    vi.mocked(selectAccountSocialsBySocialId).mockResolvedValue([]);
    expect(await checkAccountSocialAccess(ACCOUNT_ID, SOCIAL_ID)).toBe(false);
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });

  it("returns false when no owning account grants access", async () => {
    vi.mocked(selectAccountSocialsBySocialId).mockResolvedValue([
      { account_id: OWNER_ID } as never,
    ]);
    vi.mocked(checkAccountArtistAccess).mockResolvedValue(false);
    expect(await checkAccountSocialAccess(ACCOUNT_ID, SOCIAL_ID)).toBe(false);
  });

  it("propagates DB error from selectAccountSocialsBySocialId", async () => {
    vi.mocked(selectAccountSocialsBySocialId).mockRejectedValue(new Error("db blew up"));
    await expect(checkAccountSocialAccess(ACCOUNT_ID, SOCIAL_ID)).rejects.toThrow("db blew up");
    expect(checkAccountArtistAccess).not.toHaveBeenCalled();
  });
});
