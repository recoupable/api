import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readCatalogReportMembershipPage } from "../readCatalogReportMembershipPage";
const { fixtureFetch } = vi.hoisted(() => ({ fixtureFetch: vi.fn<typeof fetch>() }));
const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const catalog = "11111111-1111-4111-8111-111111111111";
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: async () => ({
    accountId: actor,
    orgId: null,
    authToken: "synthetic",
    verificationEvidence: {
      principal: { mechanism: "recoup_api_key", keyId: "test-key", actorAccountId: actor },
      effectiveAccountId: actor,
      accountAccess: { basis: "self" },
      organizationAccess: null,
      executionResources: {
        status: "unresolved",
        reason: "resource_authorization_contract_missing",
      },
    },
  }),
}));
vi.mock("@/lib/supabase/account_catalogs/selectAccountCatalogs", () => ({
  selectAccountCatalogs: async () => [{ id: catalog, owners: [actor] }],
}));
vi.mock("@/lib/supabase/serverClient", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    default: createClient("https://catalog-fixture.invalid", "synthetic-fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fixtureFetch },
    }),
  };
});
const intent = { kind: "catalog_weekly_report", catalog_id: catalog, organization_id: null };
beforeEach(() => fixtureFetch.mockReset());
it("does not mistake the legacy null-count fallback for observed zero", async () => {
  fixtureFetch.mockResolvedValue(
    new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
  );
  const result = await readCatalogReportMembershipPage(
    new NextRequest("http://localhost/internal"),
    intent,
    { page: 1, limit: 50 },
  );
  expect(result).toMatchObject({
    members: [],
    pagination: { observedTotalCount: null, hasMore: null },
    coverage: { complete: false, generation: null },
  });
  expect(fixtureFetch).toHaveBeenCalledTimes(1);
});
it("retains measured count provenance, exact filter, bounded range and SQL ordering", async () => {
  fixtureFetch.mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          catalog,
          songs: {
            isrc: "ExactCase",
            name: null,
            album: null,
            notes: null,
            updated_at: null,
            song_artists: [],
          },
        },
      ]),
      {
        status: 200,
        headers: { "content-type": "application/json", "content-range": "50-50/201" },
      },
    ),
  );
  const result = await readCatalogReportMembershipPage(
    new NextRequest("http://localhost/internal"),
    intent,
    { page: 2, limit: 50 },
  );
  expect(result).toMatchObject({
    members: [{ isrc: "ExactCase" }],
    pagination: { observedTotalCount: 201, hasMore: true },
    coverage: { complete: false },
  });
  expect(fixtureFetch).toHaveBeenCalledTimes(1);
  const query = new URL(String(fixtureFetch.mock.calls[0][0])).searchParams;
  expect(query.get("catalog")).toBe("eq." + catalog);
  expect(query.get("order")).toBe("song.desc");
  expect(query.get("offset")).toBe("50");
  expect(query.get("limit")).toBe("50");
  expect(query.has("songs.song_artists.accounts.name")).toBe(false);
});
