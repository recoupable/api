import { describe, it, expect, vi, beforeEach } from "vitest";

import { resolveCatalogOwners } from "../resolveCatalogOwners";
import { selectCatalogOwnerLinks } from "@/lib/supabase/account_catalogs/selectCatalogOwnerLinks";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { selectAccountInfos } from "@/lib/supabase/account_info/selectAccountInfos";

vi.mock("@/lib/supabase/account_catalogs/selectCatalogOwnerLinks", () => ({
  selectCatalogOwnerLinks: vi.fn(),
}));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({ selectAccounts: vi.fn() }));
vi.mock("@/lib/supabase/account_info/selectAccountInfos", () => ({ selectAccountInfos: vi.fn() }));

const person = "550e8400-e29b-41d4-a716-446655440000";
const org = "550e8400-e29b-41d4-a716-446655440111";
const catalogA = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const catalogB = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

const link = (catalog: string, account: string) => ({
  id: `${catalog}-${account}`,
  account,
  catalog,
  created_at: "2026-08-06T00:00:00Z",
  updated_at: "2026-08-06T00:00:00Z",
});

describe("resolveCatalogOwners", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty map without querying when there are no catalogs", async () => {
    const owners = await resolveCatalogOwners({
      catalogIds: [],
      ownerIds: [person, org],
      organizationIds: [org],
    });

    expect(owners.size).toBe(0);
    expect(selectCatalogOwnerLinks).not.toHaveBeenCalled();
  });

  it("marks a personal owner as not an organization and carries its avatar", async () => {
    vi.mocked(selectCatalogOwnerLinks).mockResolvedValue([link(catalogA, person)]);
    vi.mocked(selectAccounts).mockResolvedValue([
      { id: person, name: "Sweetman.eth", timestamp: 0 },
    ] as never);
    vi.mocked(selectAccountInfos).mockResolvedValue([
      { account_id: person, image: "https://img/person.png" },
    ] as never);

    const owners = await resolveCatalogOwners({
      catalogIds: [catalogA],
      ownerIds: [person, org],
      organizationIds: [org],
    });

    expect(owners.get(catalogA)).toEqual({
      id: person,
      name: "Sweetman.eth",
      image: "https://img/person.png",
      is_organization: false,
    });
  });

  it("marks an owner the caller belongs to as an organization", async () => {
    vi.mocked(selectCatalogOwnerLinks).mockResolvedValue([link(catalogA, org)]);
    vi.mocked(selectAccounts).mockResolvedValue([{ id: org, name: "Duetti" }] as never);
    vi.mocked(selectAccountInfos).mockResolvedValue([
      { account_id: org, image: "https://img/org.png" },
    ] as never);

    const owners = await resolveCatalogOwners({
      catalogIds: [catalogA],
      ownerIds: [person, org],
      organizationIds: [org],
    });

    expect(owners.get(catalogA)?.is_organization).toBe(true);
  });

  it("prefers the organization when a catalog is owned both ways", async () => {
    vi.mocked(selectCatalogOwnerLinks).mockResolvedValue([
      link(catalogA, person),
      link(catalogA, org),
    ]);
    vi.mocked(selectAccounts).mockResolvedValue([{ id: org, name: "Duetti" }] as never);
    vi.mocked(selectAccountInfos).mockResolvedValue([]);

    const owners = await resolveCatalogOwners({
      catalogIds: [catalogA],
      ownerIds: [person, org],
      organizationIds: [org],
    });

    expect(owners.get(catalogA)?.id).toBe(org);
    expect(owners.get(catalogA)?.is_organization).toBe(true);
  });

  it("returns a null image rather than omitting an owner with no avatar", async () => {
    vi.mocked(selectCatalogOwnerLinks).mockResolvedValue([link(catalogB, org)]);
    vi.mocked(selectAccounts).mockResolvedValue([{ id: org, name: "Recoup" }] as never);
    vi.mocked(selectAccountInfos).mockResolvedValue([{ account_id: org, image: null }] as never);

    const owners = await resolveCatalogOwners({
      catalogIds: [catalogB],
      ownerIds: [person, org],
      organizationIds: [org],
    });

    expect(owners.get(catalogB)).toEqual({
      id: org,
      name: "Recoup",
      image: null,
      is_organization: true,
    });
  });

  it("still reports the owner id when the account row is missing", async () => {
    vi.mocked(selectCatalogOwnerLinks).mockResolvedValue([link(catalogA, person)]);
    vi.mocked(selectAccounts).mockResolvedValue([]);
    vi.mocked(selectAccountInfos).mockResolvedValue([]);

    const owners = await resolveCatalogOwners({
      catalogIds: [catalogA],
      ownerIds: [person],
      organizationIds: [],
    });

    expect(owners.get(catalogA)).toEqual({
      id: person,
      name: null,
      image: null,
      is_organization: false,
    });
  });

  it("ignores owner links outside the set the caller reads through", async () => {
    const stranger = "550e8400-e29b-41d4-a716-446655440222";
    vi.mocked(selectCatalogOwnerLinks).mockResolvedValue([
      link(catalogA, stranger),
      link(catalogA, person),
    ]);
    vi.mocked(selectAccounts).mockResolvedValue([{ id: person, name: "Sweetman.eth" }] as never);
    vi.mocked(selectAccountInfos).mockResolvedValue([]);

    const owners = await resolveCatalogOwners({
      catalogIds: [catalogA],
      ownerIds: [person],
      organizationIds: [],
    });

    // A catalog can be linked to accounts this caller has nothing to do with —
    // naming one would be wrong attribution and a disclosure of their identity.
    expect(owners.get(catalogA)?.id).toBe(person);
    expect(selectAccounts).toHaveBeenCalledWith([person]);
  });
});
