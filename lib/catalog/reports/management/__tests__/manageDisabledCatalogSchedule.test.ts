import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { manageDisabledCatalogSchedule } from "../manageDisabledCatalogSchedule";
import { resolveCatalogReportScope } from "../../resolveCatalogReportScope";
vi.mock("../../resolveCatalogReportScope", () => ({ resolveCatalogReportScope: vi.fn() }));
const actor = "00000000-0000-0000-0000-000000000001";
const catalog = "00000000-0000-0000-0000-000000000002";
const key = "00000000-0000-0000-0000-000000000003";
const id = "00000000-0000-0000-0000-000000000004";
const requestId = "00000000-0000-0000-0000-000000000005";
const scope = { catalog_id: catalog, organization_id: null };
const state = {
  id,
  kind: "catalog_weekly_report",
  version: 1,
  ...scope,
  revision: 1,
  enabled: false,
  schedule: "0 9 * * 1",
  timezone: "UTC",
  archived_at: null,
  replayed: false,
};
const create = {
  request_id: requestId,
  command: {
    action: "create",
    payload: { ...scope, schedule: state.schedule, timezone: state.timezone },
  },
};
const request = new NextRequest("https://example.test/internal");
const rpc = vi.fn();
const transport = { rpc };
let observation: any;
beforeEach(() => {
  vi.clearAllMocks();
  observation = {
    catalogId: catalog,
    organizationId: null,
    ownerAccountId: actor,
    effectiveAccountId: actor,
    principal: { mechanism: "recoup_api_key", keyId: key, actorAccountId: actor },
    accountAccess: { basis: "self" },
    organizationAccess: null,
    observedAt: new Date().toISOString(),
    provenance: { authentication: "validateAuthContext", catalogLink: "account_catalogs" },
    executionAuthorization: "not_granted",
  };
  vi.mocked(resolveCatalogReportScope).mockImplementation(async () => observation);
  rpc.mockResolvedValue({ data: state, error: null });
});
async function status(result: unknown, code: number) {
  expect(result).toBeInstanceOf(NextResponse);
  expect((result as NextResponse).status).toBe(code);
  return (result as NextResponse).json();
}
describe("unwired disabled catalog management", () => {
  it("sends only server-derived actor/principal and the exact create contract", async () => {
    expect(await manageDisabledCatalogSchedule(request, scope, create, transport)).toEqual(state);
    expect(resolveCatalogReportScope).toHaveBeenCalledWith(request, {
      kind: "catalog_weekly_report",
      ...scope,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("mutate_catalog_report_schedule", {
      p_actor: actor,
      p_principal: { mechanism: "recoup_api_key", key_id: key },
      p_request: requestId,
      p_command: create.command,
    });
  });
  it("maps freshly verified Privy provenance without inventing key identity", async () => {
    observation.principal = {
      mechanism: "privy",
      actorAccountId: actor,
      appId: "app",
      issuer: "issuer",
      subject: "subject",
    };
    await manageDisabledCatalogSchedule(request, scope, { action: "read", id }, transport);
    expect(rpc).toHaveBeenCalledWith("read_catalog_report_schedule", {
      p_actor: actor,
      p_principal: { mechanism: "privy", app_id: "app", issuer: "issuer", subject: "subject" },
      p_id: id,
    });
  });
  it.each([
    { ...create, actor_account_id: actor },
    { ...create, command: { action: "enable", payload: { id } } },
    {
      ...create,
      command: {
        action: "create",
        payload: { ...create.command.payload, recipient_account_id: actor },
      },
    },
    {
      ...create,
      command: {
        action: "create",
        payload: { ...create.command.payload, organization_id: undefined },
      },
    },
    { ...create, request_id: "ABCDEF00-0000-0000-0000-000000000000" },
    {
      ...create,
      command: { action: "create", payload: { ...create.command.payload, schedule: "00 9 * * 1" } },
    },
    {
      request_id: requestId,
      command: { action: "disable", payload: { id, expected_revision: 1.5 } },
    },
    {
      request_id: requestId,
      command: { action: "disable", payload: { id, expected_revision: 2147483648 } },
    },
  ])("rejects invalid commands before auth or RPC", async operation => {
    await status(await manageDisabledCatalogSchedule(request, scope, operation, transport), 400);
    expect(rpc).not.toHaveBeenCalled();
    expect(resolveCatalogReportScope).not.toHaveBeenCalled();
  });
  it("rejects scope mismatch before auth", async () => {
    await status(
      await manageDisabledCatalogSchedule(
        request,
        { ...scope, organization_id: actor },
        create,
        transport,
      ),
      400,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reverifies on every call and denies revoked access before any RPC", async () => {
    await manageDisabledCatalogSchedule(request, scope, create, transport);
    vi.mocked(resolveCatalogReportScope).mockResolvedValue(NextResponse.json({}, { status: 403 }));
    await status(await manageDisabledCatalogSchedule(request, scope, create, transport), 403);
    expect(resolveCatalogReportScope).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["actor", "principal", "override"])(
    "rejects unavailable or overridden %s evidence",
    async variant => {
      if (variant === "actor") observation.effectiveAccountId = id;
      if (variant === "principal") observation.principal.keyId = undefined;
      if (variant === "override") observation.accountAccess = { basis: "shared_membership" };
      await status(await manageDisabledCatalogSchedule(request, scope, create, transport), 401);
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it.each(["edit_disabled", "disable", "archive"])(
    "pre-reads scope and preserves CAS for %s",
    async action => {
      const payload = {
        id,
        expected_revision: 1,
        ...(action === "edit_disabled"
          ? { schedule: "5 8 * * 2", timezone: "America/New_York" }
          : {}),
      };
      const result = {
        ...state,
        revision: 2,
        ...(action === "edit_disabled" ? payload : {}),
        ...(action === "archive" ? { archived_at: "2026-10-25T12:00:00+00:00" } : {}),
      };
      delete (result as any).expected_revision;
      rpc
        .mockResolvedValueOnce({ data: state, error: null })
        .mockResolvedValueOnce({ data: result, error: null });
      expect(
        await manageDisabledCatalogSchedule(
          request,
          scope,
          { request_id: requestId, command: { action, payload } },
          transport,
        ),
      ).toEqual(result);
      expect(rpc.mock.calls.map(call => call[0])).toEqual([
        "read_catalog_report_schedule",
        "mutate_catalog_report_schedule",
      ]);
    },
  );
  it("never mutates a stored schedule from another workspace", async () => {
    rpc.mockResolvedValue({ data: { ...state, organization_id: actor }, error: null });
    await status(
      await manageDisabledCatalogSchedule(
        request,
        scope,
        {
          request_id: requestId,
          command: { action: "disable", payload: { id, expected_revision: 1 } },
        },
        transport,
      ),
      502,
    );
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("allows exact historical receipt replay after later revisions", async () => {
    rpc
      .mockResolvedValueOnce({ data: { ...state, revision: 9 }, error: null })
      .mockResolvedValueOnce({ data: { ...state, revision: 2, replayed: true }, error: null });
    const result = await manageDisabledCatalogSchedule(
      request,
      scope,
      {
        request_id: requestId,
        command: { action: "disable", payload: { id, expected_revision: 1 } },
      },
      transport,
    );
    expect(result).toEqual({ ...state, revision: 2, replayed: true });
  });
  it.each([
    ["42501", 403],
    ["40001", 409],
    ["22023", 400],
    ["22003", 400],
    ["unknown", 500],
  ])("sanitizes SQL error %s and never retries", async (code, expected) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "secret backend content" } });
    const body = await status(
      await manageDisabledCatalogSchedule(request, scope, create, transport),
      expected as number,
    );
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    { enabled: true },
    { catalog_id: actor },
    { id: "bad" },
    { revision: 2 },
    { token: "secret" },
    { archived_at: "bad" },
  ])("rejects incompatible create responses %j", async change => {
    rpc.mockResolvedValue({ data: { ...state, ...change }, error: null });
    await status(await manageDisabledCatalogSchedule(request, scope, create, transport), 502);
  });
  it("sanitizes transport throws", async () => {
    rpc.mockRejectedValue(new Error("secret"));
    const body = await status(
      await manageDisabledCatalogSchedule(request, scope, create, transport),
      500,
    );
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});

describe("exact SQL serialization boundary", () => {
  it.each(["\n", "\r", "\u2028", "\u2029"])(
    "rejects trailing line terminator %j before auth",
    async suffix => {
      const operation = {
        ...create,
        command: {
          ...create.command,
          payload: { ...create.command.payload, schedule: state.schedule + suffix },
        },
      };
      await status(await manageDisabledCatalogSchedule(request, scope, operation, transport), 400);
      expect(resolveCatalogReportScope).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it.each(["America/Port-au-Prince", "Etc/GMT+5", "EST", "UTC\n"])(
    "rejects SQL-incompatible timezone %s",
    async timezone => {
      await status(
        await manageDisabledCatalogSchedule(
          request,
          scope,
          {
            ...create,
            command: { ...create.command, payload: { ...create.command.payload, timezone } },
          },
          transport,
        ),
        400,
      );
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it.each(["bad\u0000value", "bad\ud800value", "bad\udc00value"])(
    "rejects unrepresentable principal %j",
    async subject => {
      observation.principal = {
        mechanism: "privy",
        actorAccountId: actor,
        appId: "app",
        issuer: "issuer",
        subject,
      };
      await status(await manageDisabledCatalogSchedule(request, scope, create, transport), 401);
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("rejects lossy non-enumerable fields instead of dropping their meaning", async () => {
    const input = { ...create };
    Object.defineProperty(input, "actor_account_id", { value: actor, enumerable: false });
    await status(await manageDisabledCatalogSchedule(request, scope, input, transport), 400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("preserves reordered receipt commands and original request identity", async () => {
    const command = {
      payload: {
        timezone: "UTC",
        schedule: state.schedule,
        organization_id: null,
        catalog_id: catalog,
      },
      action: "create",
    };
    rpc.mockResolvedValue({ data: { ...state, replayed: true }, error: null });
    expect(
      await manageDisabledCatalogSchedule(
        request,
        scope,
        { command, request_id: requestId },
        transport,
      ),
    ).toEqual({ ...state, replayed: true });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_request: requestId, p_command: create.command });
  });
});
