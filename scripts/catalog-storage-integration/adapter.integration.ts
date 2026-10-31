import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { manageDisabledCatalogSchedule } from "@/lib/catalog/reports/management/manageDisabledCatalogSchedule";
import { resolveCatalogReportScope } from "@/lib/catalog/reports/resolveCatalogReportScope";
import type { DisabledCatalogScheduleState } from "@/lib/catalog/reports/management/disabledCatalogScheduleState";
import type { VerifiedCredential } from "@/lib/auth/VerificationEvidence";
import { catalogReportIntentSchema } from "@/lib/catalog/reports/catalogReportIntent";
import { createLocalCatalogRpc } from "./createLocalCatalogRpc";
vi.mock("@/lib/catalog/reports/resolveCatalogReportScope", () => ({
  resolveCatalogReportScope: vi.fn(),
}));
const setup = JSON.parse(readFileSync(process.env.CATALOG_STORAGE_FIXTURE!, "utf8"));
const local = createLocalCatalogRpc(setup);
const request = new NextRequest("https://synthetic.invalid/internal");
let fixture: {
  actor: string;
  org: string;
  catalog: string;
  principal: { mechanism: "recoup_api_key"; key_id: string };
};
let scope: { catalog_id: string; organization_id: string | null };
let principal: VerifiedCredential;
let nextFixture = 0;
beforeEach(() => {
  fixture = setup.fixtures[nextFixture++];
  expect(fixture).toBeDefined();
  scope = { catalog_id: fixture.catalog, organization_id: null };
  principal = { mechanism: "recoup_api_key", keyId: fixture.principal.key_id };
  local.calls.length = 0;
  vi.mocked(resolveCatalogReportScope)
    .mockReset()
    .mockImplementation(async (_request, input) => {
      const intent = catalogReportIntentSchema.parse(input);
      return {
        catalogId: intent.catalog_id,
        organizationId: intent.organization_id,
        ownerAccountId: intent.organization_id ?? fixture.actor,
        effectiveAccountId: fixture.actor,
        principal: { ...principal, actorAccountId: fixture.actor },
        accountAccess: { basis: "self" },
        organizationAccess:
          intent.organization_id === null
            ? null
            : { basis: "membership", organizationId: intent.organization_id },
        observedAt: new Date().toISOString(),
        provenance: { authentication: "validateAuthContext", catalogLink: "account_catalogs" },
        executionAuthorization: "not_granted",
      };
    });
});
const command = (action: string, payload: object, request_id = randomUUID()) => ({
  request_id,
  command: { action, payload },
});
const create = (requestId = randomUUID()) =>
  command("create", { ...scope, schedule: "0 9 * * 1", timezone: "America/New_York" }, requestId);
const run = (operation: unknown) =>
  manageDisabledCatalogSchedule(request, scope, operation, local.transport);
function success(result: unknown): DisabledCatalogScheduleState {
  expect(result).not.toBeInstanceOf(NextResponse);
  return result as DisabledCatalogScheduleState;
}
async function failure(result: unknown, status: number) {
  expect(result).toBeInstanceOf(NextResponse);
  expect((result as NextResponse).status).toBe(status);
  const body = await (result as NextResponse).text();
  expect(body).not.toContain("ERROR:");
  expect(body).not.toContain(fixture.actor);
}

it("accepts real lifecycle responses and historical create/edit/archive receipts", async () => {
  const original = create();
  const first = success(await run(original));
  expect(first).toMatchObject({
    revision: 1,
    enabled: false,
    archived_at: null,
    replayed: false,
    ...scope,
  });
  expect(success(await run({ action: "read", id: first.id })).id).toBe(first.id);
  const edit = command("edit_disabled", {
    id: first.id,
    expected_revision: 1,
    schedule: "30 8 * * 2",
    timezone: "UTC",
  });
  expect(success(await run(edit))).toMatchObject({
    revision: 2,
    schedule: "30 8 * * 2",
    timezone: "UTC",
  });
  expect(
    success(await run(command("disable", { id: first.id, expected_revision: 2 }))),
  ).toMatchObject({ revision: 3, enabled: false });
  const archive = command("archive", { id: first.id, expected_revision: 3 });
  const archived = success(await run(archive));
  expect(archived.revision).toBe(4);
  expect(archived.archived_at).not.toBeNull();
  expect(success(await run(original))).toMatchObject({
    revision: 1,
    archived_at: null,
    replayed: true,
  });
  expect(success(await run(edit))).toMatchObject({
    revision: 2,
    archived_at: null,
    replayed: true,
  });
  expect(success(await run(archive))).toEqual({ ...archived, replayed: true });
  expect(success(await run({ action: "read", id: first.id }))).toEqual({
    ...archived,
    replayed: false,
  });
  expect(
    local.admin(
      `SELECT count(*) FROM catalog_report_schedule_revisions WHERE schedule_id='${first.id}'`,
    ),
  ).toBe("4");
  expect(vi.mocked(resolveCatalogReportScope)).toHaveBeenCalledTimes(9);
});
it("denies changed payload under the same request key and stale revisions without retry", async () => {
  const original = create();
  const first = success(await run(original));
  const before = local.calls.length;
  await failure(
    await run({
      ...original,
      command: { ...original.command, payload: { ...original.command.payload, timezone: "UTC" } },
    }),
    400,
  );
  expect(local.calls.length - before).toBe(1);
  await failure(await run(command("disable", { id: first.id, expected_revision: 2 })), 409);
  expect(success(await run({ action: "read", id: first.id })).revision).toBe(1);
});
it("denies a new key of the same actor using SQL original-principal matching", async () => {
  const first = success(await run(create()));
  principal = { mechanism: "recoup_api_key", keyId: randomUUID() };
  await failure(await run({ action: "read", id: first.id }), 403);
  await failure(await run(command("archive", { id: first.id, expected_revision: 1 })), 403);
  expect(local.calls.filter(c => c.name === "mutate_catalog_report_schedule")).toHaveLength(1);
});
it("rejects an existing ID from a different explicit workspace before mutation", async () => {
  const first = success(await run(create()));
  scope.organization_id = fixture.org;
  await failure(await run(command("disable", { id: first.id, expected_revision: 1 })), 502);
  expect(local.calls.filter(c => c.name === "mutate_catalog_report_schedule")).toHaveLength(1);
});
it("SQL rejects revoked membership and exact owner link despite synthetic auth allowing it", async () => {
  scope.organization_id = fixture.org;
  const original = create();
  const first = success(await run(original));
  local.admin(
    `DELETE FROM account_organization_ids WHERE account_id='${fixture.actor}' AND organization_id='${fixture.org}'`,
  );
  await failure(await run({ action: "read", id: first.id }), 403);
  await failure(await run(original), 403);
  local.admin(
    `INSERT INTO account_organization_ids(account_id,organization_id) VALUES ('${fixture.actor}','${fixture.org}'); DELETE FROM account_catalogs WHERE account='${fixture.org}' AND catalog='${fixture.catalog}'`,
  );
  await failure(await run({ action: "read", id: first.id }), 403);
  expect(
    local.admin(
      `SELECT count(*) FROM account_catalogs WHERE account='${fixture.actor}' AND catalog='${fixture.catalog}'`,
    ),
  ).toBe("1");
});
it("rejects malformed scope and lossy serialization before auth or local RPC", async () => {
  const op = create();
  await failure(
    await manageDisabledCatalogSchedule(
      request,
      { catalog_id: fixture.catalog },
      op,
      local.transport,
    ),
    400,
  );
  const hidden = { ...op };
  Object.defineProperty(hidden, "actor", { value: fixture.actor });
  await failure(await run(hidden), 400);
  await failure(
    await run({
      ...op,
      command: { ...op.command, payload: { ...op.command.payload, schedule: "0 9 * * 1\n" } },
    }),
    400,
  );
  expect(local.calls).toHaveLength(0);
  expect(resolveCatalogReportScope).not.toHaveBeenCalled();
});
it("does not retry after commit-then-transport ambiguity; explicit same-key retry returns receipt", async () => {
  const original = create();
  const actualRpc = local.transport.rpc.bind(local.transport);
  const ambiguous = vi.spyOn(local.transport, "rpc").mockImplementationOnce(async (name, args) => {
    await actualRpc(name, args);
    throw new Error("synthetic transport lost after commit");
  });
  await failure(await run(original), 500);
  expect(ambiguous).toHaveBeenCalledTimes(1);
  ambiguous.mockRestore();
  expect(local.calls).toHaveLength(1);
  expect(
    local.admin(
      `SELECT count(*) FROM catalog_report_schedules WHERE actor_account_id='${fixture.actor}'`,
    ),
  ).toBe("1");
  const replay = success(await run(original));
  expect(replay).toMatchObject({ revision: 1, replayed: true, enabled: false });
  expect(resolveCatalogReportScope).toHaveBeenCalledTimes(2);
});
it("accepts synthetic Privy principal through actual SQL and direct create-to-archive", async () => {
  principal = {
    mechanism: "privy",
    appId: "fixture-app",
    issuer: "fixture-issuer",
    subject: "did:privy:fixture",
  };
  const first = success(await run(create()));
  const archived = success(await run(command("archive", { id: first.id, expected_revision: 1 })));
  expect(archived).toMatchObject({ revision: 2, enabled: false });
  expect(archived.archived_at).not.toBeNull();
  principal = {
    mechanism: "privy",
    appId: "fixture-app",
    issuer: "fixture-issuer",
    subject: "did:privy:other",
  };
  await failure(await run({ action: "read", id: first.id }), 403);
});
it("leaves timezone existence to SQL and sanitizes invalid zones", async () => {
  const op = create();
  await failure(
    await run({
      ...op,
      command: { ...op.command, payload: { ...op.command.payload, timezone: "Invalid/Zone" } },
    }),
    400,
  );
  expect(local.calls).toHaveLength(1);
  expect(
    local.admin(
      `SELECT count(*) FROM catalog_report_schedules WHERE actor_account_id='${fixture.actor}'`,
    ),
  ).toBe("0");
});
