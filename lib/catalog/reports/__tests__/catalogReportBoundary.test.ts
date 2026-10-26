import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { resolveCatalogReportScope } from "../resolveCatalogReportScope";
import { readCatalogReportMembershipPage } from "../readCatalogReportMembershipPage";
const { auth, catalogs, songs } = vi.hoisted(() => ({
  auth: vi.fn(),
  catalogs: vi.fn(),
  songs: vi.fn(),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: auth }));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: catalogs,
}));
vi.mock("@/lib/supabase/catalog_songs/selectCatalogSongsWithArtists", () => ({
  selectCatalogSongsWithArtists: songs,
}));
const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  org = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  catalog = "11111111-1111-4111-8111-111111111111";
const intent = { kind: "catalog_weekly_report", catalog_id: catalog, organization_id: null };
const req = () =>
  new NextRequest("http://localhost/internal-only", {
    headers: { authorization: "Bearer never-return-this" },
  });
function evidence(organizationId: string | null = null) {
  return {
    accountId: actor,
    orgId: organizationId,
    authToken: "never-return-this",
    verificationEvidence: {
      principal: {
        mechanism: "privy",
        appId: "test-app",
        issuer: "privy",
        subject: "test-subject",
        actorAccountId: actor,
      },
      effectiveAccountId: actor,
      accountAccess: { basis: "self" },
      organizationAccess: organizationId ? { basis: "membership", organizationId } : null,
      executionResources: {
        status: "unresolved",
        reason: "resource_authorization_contract_missing",
      },
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  auth.mockResolvedValue(evidence());
  catalogs.mockResolvedValue([{ id: catalog, owners: [actor] }]);
  songs.mockResolvedValue({
    songs: [{ catalog_id: catalog, isrc: "EXACT001", artists: [] }],
    observed_total_count: 201,
  });
});
describe("fresh current-request authority observation", () => {
  it("uses verified auth and exact personal owner; never returns token or execution grant", async () => {
    const request = req();
    const result = await resolveCatalogReportScope(request, intent);
    expect(auth).toHaveBeenCalledWith(request, {
      organizationId: null,
      includeVerificationEvidence: true,
    });
    expect(catalogs).toHaveBeenCalledWith([actor], { catalogIds: [catalog] });
    expect(result).toMatchObject({
      catalogId: catalog,
      ownerAccountId: actor,
      effectiveAccountId: actor,
      principal: { actorAccountId: actor },
      executionAuthorization: "not_granted",
    });
    expect(JSON.stringify(result)).not.toContain("never-return-this");
  });
  it("uses only selected org, not every visible org", async () => {
    auth.mockResolvedValue(evidence(org));
    catalogs.mockResolvedValue([{ id: catalog, owners: [org] }]);
    expect(
      await resolveCatalogReportScope(req(), { ...intent, organization_id: org }),
    ).toMatchObject({ ownerAccountId: org, organizationId: org });
    expect(catalogs).toHaveBeenCalledWith([org], { catalogIds: [catalog] });
  });
  it.each([401, 403])("stops before catalog reads on auth %s", async status => {
    auth.mockResolvedValue(NextResponse.json({ error: "denied" }, { status }));
    expect(await resolveCatalogReportScope(req(), intent)).toHaveProperty("status", status);
    expect(catalogs).not.toHaveBeenCalled();
  });
  it("rejects absent evidence without inventing principal", async () => {
    auth.mockResolvedValue({ ...evidence(), verificationEvidence: undefined });
    expect(await resolveCatalogReportScope(req(), intent)).toHaveProperty("status", 401);
    expect(catalogs).not.toHaveBeenCalled();
  });
  it("rejects mismatched effective account evidence", async () => {
    const value = evidence();
    value.verificationEvidence.effectiveAccountId = org;
    auth.mockResolvedValue(value);
    expect(await resolveCatalogReportScope(req(), intent)).toHaveProperty("status", 401);
  });
  it("rejects wrong workspace evidence", async () => {
    auth.mockResolvedValue(evidence());
    expect(
      await resolveCatalogReportScope(req(), { ...intent, organization_id: org }),
    ).toHaveProperty("status", 403);
    expect(catalogs).not.toHaveBeenCalled();
  });
  it.each(
    [[], [{ id: catalog, owners: [org] }], [{ id: "other", owners: [actor] }]].map(rows => ({
      rows,
    })),
  )("rejects missing/wrong exact link", async ({ rows }) => {
    catalogs.mockResolvedValue(rows);
    expect(await resolveCatalogReportScope(req(), intent)).toHaveProperty("status", 403);
  });
  it("rechecks every call and fails closed after link removal", async () => {
    await resolveCatalogReportScope(req(), intent);
    catalogs.mockResolvedValue([]);
    expect(await resolveCatalogReportScope(req(), intent)).toHaveProperty("status", 403);
    expect(auth).toHaveBeenCalledTimes(2);
  });
  it("reports DB error without leaking it", async () => {
    catalogs.mockRejectedValue(new Error("private database detail"));
    const result = await resolveCatalogReportScope(req(), intent);
    expect(result).toHaveProperty("status", 500);
    expect(await (result as NextResponse).text()).not.toContain("private database detail");
  });
  it("rejects forged scope input before authentication or reads", async () => {
    expect(await resolveCatalogReportScope(req(), { ...intent, actor_id: actor })).toHaveProperty(
      "status",
      400,
    );
    expect(auth).not.toHaveBeenCalled();
    expect(catalogs).not.toHaveBeenCalled();
  });
});
describe("one bounded membership observation", () => {
  it("uses exact catalog, no artist filter, and never traverses other pages", async () => {
    const result = await readCatalogReportMembershipPage(req(), intent, { page: 2, limit: 50 });
    expect(songs).toHaveBeenCalledExactlyOnceWith({
      catalogId: catalog,
      page: 2,
      limit: 50,
      observeCount: true,
    });
    expect(result).toMatchObject({
      members: [{ isrc: "EXACT001" }],
      pagination: { page: 2, limit: 50, returned: 1, observedTotalCount: 201, hasMore: true },
      coverage: {
        complete: false,
        generation: null,
        reason: "stable_membership_generation_unavailable",
      },
    });
    expect(auth).toHaveBeenCalledTimes(2);
    expect(catalogs).toHaveBeenCalledTimes(2);
  });
  it.each([null, undefined, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "marks invalid total %s unknown",
    async total_count => {
      songs.mockResolvedValue({
        songs: [{ catalog_id: catalog, isrc: "X" }],
        observed_total_count: total_count,
      });
      expect(
        await readCatalogReportMembershipPage(req(), intent, { page: 1, limit: 50 }),
      ).toMatchObject({
        pagination: { observedTotalCount: null, hasMore: null },
        coverage: { complete: false },
      });
    },
  );
  it("zero is an observed count, never a stable whole-catalog claim", async () => {
    songs.mockResolvedValue({ songs: [], observed_total_count: 0 });
    expect(
      await readCatalogReportMembershipPage(req(), intent, { page: 1, limit: 50 }),
    ).toMatchObject({
      members: [],
      pagination: { observedTotalCount: 0, hasMore: false },
      coverage: { complete: false, generation: null },
    });
  });
  it.each([
    { page: 0, limit: 50 },
    { page: 1, limit: 101 },
    { page: 1.5, limit: 1 },
    { page: Number.MAX_SAFE_INTEGER, limit: 100 },
    { page: 1, limit: 5, artistName: "no" },
  ])("rejects invalid page before reads", async page => {
    expect(await readCatalogReportMembershipPage(req(), intent, page)).toHaveProperty(
      "status",
      400,
    );
    expect(auth).not.toHaveBeenCalled();
    expect(songs).not.toHaveBeenCalled();
  });
  it("does not return rows when membership is revoked during read", async () => {
    catalogs.mockResolvedValueOnce([{ id: catalog, owners: [actor] }]).mockResolvedValueOnce([]);
    expect(
      await readCatalogReportMembershipPage(req(), intent, { page: 1, limit: 50 }),
    ).toHaveProperty("status", 403);
  });
  it("rejects an identity change during the observation", async () => {
    const changed = evidence();
    changed.verificationEvidence.principal.subject = "different";
    auth.mockResolvedValueOnce(evidence()).mockResolvedValueOnce(changed);
    expect(
      await readCatalogReportMembershipPage(req(), intent, { page: 1, limit: 50 }),
    ).toHaveProperty("status", 409);
  });
  it.each(
    [
      [{ catalog_id: "other", isrc: "X" }],
      [{ catalog_id: catalog, isrc: "" }],
      [
        { catalog_id: catalog, isrc: "X" },
        { catalog_id: catalog, isrc: "X" },
      ],
    ].map(rows => ({ rows })),
  )("rejects invalid/mixed membership rows", async ({ rows }) => {
    songs.mockResolvedValue({ songs: rows, observed_total_count: rows.length });
    expect(
      await readCatalogReportMembershipPage(req(), intent, { page: 1, limit: 50 }),
    ).toHaveProperty("status", 500);
  });
  it("retains case-sensitive identities and creator-less membership", async () => {
    songs.mockResolvedValue({
      songs: [
        { catalog_id: catalog, isrc: "Case", artists: [] },
        { catalog_id: catalog, isrc: "CASE", artists: [{ name: "Other creator" }] },
      ],
      observed_total_count: 2,
    });
    expect(
      await readCatalogReportMembershipPage(req(), intent, { page: 1, limit: 50 }),
    ).toMatchObject({ members: [{ isrc: "Case" }, { isrc: "CASE" }] });
  });
  it("fails closed on songs failure without exposing detail", async () => {
    songs.mockRejectedValue(new Error("private query"));
    const result = await readCatalogReportMembershipPage(req(), intent, { page: 1, limit: 50 });
    expect(result).toHaveProperty("status", 500);
    expect(await (result as NextResponse).text()).not.toContain("private query");
  });
});
