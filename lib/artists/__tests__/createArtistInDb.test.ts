import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsertAccount = vi.fn();
const mockInsertAccountInfo = vi.fn();
const mockSelectAccountWithSocials = vi.fn();
const mockInsertAccountArtistId = vi.fn();
const mockAddArtistToOrganization = vi.fn();

vi.mock("@/lib/supabase/accounts/insertAccount", () => ({
  insertAccount: (...args: unknown[]) => mockInsertAccount(...args),
}));

vi.mock("@/lib/supabase/account_info/insertAccountInfo", () => ({
  insertAccountInfo: (...args: unknown[]) => mockInsertAccountInfo(...args),
}));

vi.mock("@/lib/supabase/accounts/selectAccountWithSocials", () => ({
  selectAccountWithSocials: (...args: unknown[]) => mockSelectAccountWithSocials(...args),
}));

vi.mock("@/lib/supabase/account_artist_ids/insertAccountArtistId", () => ({
  insertAccountArtistId: (...args: unknown[]) => mockInsertAccountArtistId(...args),
}));

vi.mock("@/lib/supabase/artist_organization_ids/addArtistToOrganization", () => ({
  addArtistToOrganization: (...args: unknown[]) => mockAddArtistToOrganization(...args),
}));

import { createArtistInDb } from "../createArtistInDb";

describe("createArtistInDb", () => {
  const mockAccount = {
    id: "artist-123",
    name: "Test Artist",
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
  };

  const mockAccountInfo = {
    id: "info-123",
    account_id: "artist-123",
    image: null,
    instruction: null,
    knowledges: null,
    label: null,
    organization: null,
    company_name: null,
    job_title: null,
    role_type: null,
    onboarding_status: null,
    onboarding_data: null,
  };

  const mockFullAccount = {
    ...mockAccount,
    account_socials: [],
    account_info: [mockAccountInfo],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an artist account with all required steps", async () => {
    mockInsertAccount.mockResolvedValue(mockAccount);
    mockInsertAccountInfo.mockResolvedValue(mockAccountInfo);
    mockSelectAccountWithSocials.mockResolvedValue(mockFullAccount);
    mockInsertAccountArtistId.mockResolvedValue({ id: "rel-123" });

    const result = await createArtistInDb("Test Artist", "owner-456");

    expect(mockInsertAccount).toHaveBeenCalledWith({ name: "Test Artist" });
    expect(mockInsertAccountInfo).toHaveBeenCalledWith({ account_id: "artist-123" });
    expect(mockSelectAccountWithSocials).toHaveBeenCalledWith("artist-123");
    expect(mockInsertAccountArtistId).toHaveBeenCalledWith("owner-456", "artist-123");
    expect(result).toMatchObject({
      id: "artist-123",
      account_id: "artist-123",
      name: "Test Artist",
    });
  });

  it("links artist to organization when organizationId is provided", async () => {
    mockInsertAccount.mockResolvedValue(mockAccount);
    mockInsertAccountInfo.mockResolvedValue(mockAccountInfo);
    mockSelectAccountWithSocials.mockResolvedValue(mockFullAccount);
    mockInsertAccountArtistId.mockResolvedValue({ id: "rel-123" });
    mockAddArtistToOrganization.mockResolvedValue("org-rel-123");

    const result = await createArtistInDb("Test Artist", "owner-456", "org-789");

    expect(mockAddArtistToOrganization).toHaveBeenCalledWith("artist-123", "org-789");
    expect(result).not.toBeNull();
  });

  it("returns null when account creation fails", async () => {
    mockInsertAccount.mockRejectedValue(new Error("Insert failed"));

    const result = await createArtistInDb("Test Artist", "owner-456");

    expect(result).toBeNull();
    expect(mockInsertAccountInfo).not.toHaveBeenCalled();
  });

  it("returns null when account info creation fails", async () => {
    mockInsertAccount.mockResolvedValue(mockAccount);
    mockInsertAccountInfo.mockResolvedValue(null);

    const result = await createArtistInDb("Test Artist", "owner-456");

    expect(result).toBeNull();
    expect(mockSelectAccountWithSocials).not.toHaveBeenCalled();
  });

  it("returns null when fetching full account data fails", async () => {
    mockInsertAccount.mockResolvedValue(mockAccount);
    mockInsertAccountInfo.mockResolvedValue(mockAccountInfo);
    mockSelectAccountWithSocials.mockResolvedValue(null);

    const result = await createArtistInDb("Test Artist", "owner-456");

    expect(result).toBeNull();
    expect(mockInsertAccountArtistId).not.toHaveBeenCalled();
  });

  it("returns null when associating artist with owner fails", async () => {
    mockInsertAccount.mockResolvedValue(mockAccount);
    mockInsertAccountInfo.mockResolvedValue(mockAccountInfo);
    mockSelectAccountWithSocials.mockResolvedValue(mockFullAccount);
    mockInsertAccountArtistId.mockRejectedValue(new Error("Association failed"));

    const result = await createArtistInDb("Test Artist", "owner-456");

    expect(result).toBeNull();
  });
});
