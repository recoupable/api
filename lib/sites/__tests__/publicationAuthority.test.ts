import { beforeEach, expect, it, vi } from "vitest";
import { authorizeSelectedSitePublication } from "../production/publication/authorizeSelectedSitePublication";
import { readPaidSiteSubscription } from "../fanConnection/readPaidSiteSubscription";
import { getFanOAuthConfig } from "../fanConnection/getFanOAuthConfig";
import { selectFanConfig } from "@/lib/supabase/site_fan_connections/selectFanConfig";
import { selectAccounts } from "@/lib/supabase/accounts/selectAccounts";
import { selectArtistOrganizationIds } from "@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds";
import { checkAccountArtistAccess } from "@/lib/artists/checkAccountArtistAccess";
import { readSiteContextBrief } from "../production/readSiteContextBrief";
import type { Site, SiteSnapshot } from "../schema";
vi.mock("../fanConnection/readPaidSiteSubscription", () => ({ readPaidSiteSubscription: vi.fn() }));
vi.mock("../fanConnection/getFanOAuthConfig", () => ({ getFanOAuthConfig: vi.fn() }));
vi.mock("@/lib/supabase/site_fan_connections/selectFanConfig", () => ({
  selectFanConfig: vi.fn(),
}));
vi.mock("@/lib/supabase/accounts/selectAccounts", () => ({ selectAccounts: vi.fn() }));
vi.mock("@/lib/supabase/artist_organization_ids/selectArtistOrganizationIds", () => ({
  selectArtistOrganizationIds: vi.fn(),
}));
vi.mock("@/lib/artists/checkAccountArtistAccess", () => ({ checkAccountArtistAccess: vi.fn() }));
vi.mock("../production/readSiteContextBrief", () => ({ readSiteContextBrief: vi.fn() }));
const site = { id: "site", owner_id: "workspace", artist_id: "artist" } as Site;
const candidate = {
  production: { context: { engine: { briefId: "brief" } } },
} as unknown as SiteSnapshot;
const authorize = () =>
  authorizeSelectedSitePublication("actor", { site, candidate }, "https://example.com/site");
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readPaidSiteSubscription).mockResolvedValue(true);
  vi.mocked(selectArtistOrganizationIds).mockResolvedValue([
    { organization_id: "workspace" },
  ] as never);
  vi.mocked(selectAccounts).mockResolvedValue([{ name: "Artist" }] as never);
  vi.mocked(selectFanConfig).mockResolvedValue({
    site_id: "site",
    enabled: true,
    return_url: "https://example.com/site",
    revision: 1,
    marketing_text: "Consent",
  });
});
it("checks the existing brief, workspace artist, fresh paid entitlement, OAuth and prepared fan config", async () => {
  await authorize();
  expect(readSiteContextBrief).toHaveBeenCalledWith(site, "actor", "brief");
  expect(readPaidSiteSubscription).toHaveBeenCalledWith("workspace", { throwOnError: true });
  expect(getFanOAuthConfig).toHaveBeenCalledOnce();
});
it.each([
  "unpaid",
  "missing-artist",
  "foreign-artist",
  "missing-fan-config",
  "changed-destination",
  "disabled",
  "nameless",
])("rejects %s", async kind => {
  let current = site;
  if (kind === "unpaid") vi.mocked(readPaidSiteSubscription).mockResolvedValue(false);
  if (kind === "missing-artist") current = { ...site, artist_id: null };
  if (kind === "foreign-artist") vi.mocked(selectArtistOrganizationIds).mockResolvedValue([]);
  if (kind === "missing-fan-config") vi.mocked(selectFanConfig).mockResolvedValue(null);
  if (kind === "changed-destination")
    vi.mocked(selectFanConfig).mockResolvedValue({
      site_id: "site",
      enabled: true,
      return_url: "https://other.test",
      revision: 1,
      marketing_text: "Consent",
    });
  if (kind === "disabled")
    vi.mocked(selectFanConfig).mockResolvedValue({
      site_id: "site",
      enabled: false,
      return_url: "https://example.com/site",
      revision: 1,
      marketing_text: "Consent",
    });
  if (kind === "nameless") vi.mocked(selectAccounts).mockResolvedValue([{ name: " " }] as never);
  await expect(
    authorizeSelectedSitePublication(
      "actor",
      { site: current, candidate },
      "https://example.com/site",
    ),
  ).rejects.toThrow();
});
it("allows existing personal artist access but not a workspace bypass", async () => {
  vi.mocked(selectArtistOrganizationIds).mockResolvedValue([]);
  vi.mocked(checkAccountArtistAccess).mockResolvedValue(true);
  await authorizeSelectedSitePublication(
    "workspace",
    { site, candidate },
    "https://example.com/site",
  );
  await expect(authorize()).rejects.toMatchObject({ status: 403 });
});
it("propagates context and configuration read errors", async () => {
  vi.mocked(readSiteContextBrief).mockRejectedValue(new Error("Context revoked"));
  await expect(authorize()).rejects.toThrow("Context revoked");
  vi.mocked(readSiteContextBrief).mockResolvedValue({} as never);
  vi.mocked(selectFanConfig).mockRejectedValue(new Error("Unavailable"));
  await expect(authorize()).rejects.toThrow("Unavailable");
});

it("short-circuits personal artist lookup when existing workspace ownership suffices", async () => {
  await authorizeSelectedSitePublication(
    "workspace",
    { site, candidate },
    "https://example.com/site",
  );
  expect(checkAccountArtistAccess).not.toHaveBeenCalled();
});
