import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Provider } from "oidc-provider";
import { afterEach, expect, it, vi } from "vitest";
import { createOAuthAdapter } from "../createOAuthAdapter";
import { createOAuthCipher } from "../createOAuthCipher";
import type { OAuthRuntimeConfig } from "../loadOAuthConfig";
import type { OAuthStore, OAuthStoredRecord } from "../OAuthStore";
import { createOAuthConsentHandler } from "../consent/createOAuthConsentHandler";

const membership = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/lib/supabase/account_organization_ids/getAccountOrganizations", () => ({
  getAccountOrganizations: vi.fn(async () =>
    membership.allowed
      ? [
          {
            organization_id: "00000000-0000-4000-8000-000000000002",
            organization: { id: "00000000-0000-4000-8000-000000000002", name: "Fixture label" },
          },
        ]
      : [],
  ),
}));
afterEach(() => {
  membership.allowed = true;
  vi.restoreAllMocks();
});

function fixture() {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const records = new Map<string, OAuthStoredRecord>();
  let failure = "";
  const check = (operation: string, model: string) => {
    if (failure === `${model}.${operation}`)
      throw new Error("secret backend credential account token state code");
  };
  const store: OAuthStore = {
    upsert: async record => {
      check("upsert", record.model);
      records.set(record.idHash, {
        id_hash: record.idHash,
        payload: record.payload,
        consumed: null,
      });
    },
    find: async query => {
      check("find", query.model);
      return records.get(query.hash) ?? null;
    },
    consume: async key => {
      check("consume", key.model);
      const record = records.get(key.idHash);
      if (!record || record.consumed) return false;
      record.consumed = 1;
      return true;
    },
    destroy: async key => {
      check("destroy", key.model);
    },
    revokeGrant: vi.fn(async () => {
      check("revoke", "Grant");
    }),
  };
  const adapter = createOAuthAdapter({
    namespace: "diagnostics-test",
    indexKey: Buffer.alloc(32, 1),
    cipher: createOAuthCipher({ activeKeyId: "test", keys: { test: Buffer.alloc(32, 2) } }),
    store,
    invalidGrant: () => Object.assign(new Error("invalid_grant"), { error: "invalid_grant" }),
  });
  const details = {
    uid: "private-interaction",
    prompt: { name: "consent" },
    params: { client_id: "private-client", scope: "mcp:read" },
  };
  const provider = {
    interactionDetails: vi.fn(async () => {
      await adapter("Session").find("private-session");
      return details;
    }),
    Client: {
      find: vi.fn(async () => {
        await adapter("Client").find("private-client");
        return { clientName: "Private name" };
      }),
    },
    Grant: class {
      exp = 0;
      static async find() {
        await adapter("Grant").find("private-grant");
        return { exp: 253402300799 };
      }

      addResourceScope() {}
      addOIDCScope() {}
      async save() {
        await adapter("Grant").upsert("private-grant", { exp: this.exp }, 300);
        return "private-grant";
      }
    },
    interactionResult: vi.fn(async () => {
      await adapter("Session").destroy("private-session");
      return "https://client.example/callback?code=private-code";
    }),
  };
  const resolveIdentity = vi.fn(async () => ({
    accountId: "00000000-0000-4000-8000-000000000001",
    subject: "did:privy:private-subject",
  }));
  const handler = createOAuthConsentHandler({
    config: {
      consentOrigin: "https://chat.example",
      consentUrl: "https://chat.example/oauth/authorize",
      resource: "https://api.example/mcp",
    } as OAuthRuntimeConfig,
    provider: provider as unknown as Provider,
    adapter,
    resolveIdentity,
  });
  const request = async (body?: unknown, query = "") => {
    const req = Object.assign(Readable.from(body ? [JSON.stringify(body)] : []), {
      method: body ? "POST" : "GET",
      url: `/interaction/private-interaction${query}`,
      headers: {
        origin: "https://chat.example",
        authorization: "Bearer private-token",
        "content-type": "application/json",
        cookie: "private-cookie",
      },
    });
    const res = { removeHeader: vi.fn(), setHeader: vi.fn(), writeHead: vi.fn(), end: vi.fn() };
    await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse, details.uid);
    return { status: res.writeHead.mock.calls[0][0], body: JSON.parse(res.end.mock.calls[0][0]) };
  };
  return {
    log,
    store,
    provider,
    details,
    resolveIdentity,
    request,
    fail: (value: string) => {
      failure = value;
    },
  };
}

it.each(["Session.find", "Client.find", "RecoupInteraction.upsert"])(
  "reports %s preview storage failure without changing the public response",
  async operation => {
    const f = fixture();
    f.fail(operation);
    expect(await f.request()).toEqual({
      status: 400,
      body: { error: "invalid_or_expired_interaction" },
    });
    expect(f.log.mock.calls).toEqual([
      ["OAuth consent storage unavailable", { event: "oauth_consent_storage_unavailable" }],
    ]);
  },
);

it.each([
  "RecoupInteraction.find",
  "RecoupInteraction.consume",
  "Grant.upsert",
  "Grant.find",
  "RecoupGrant.upsert",
  "Session.destroy",
])("reports %s approval storage failure with only fixed event fields", async operation => {
  const f = fixture();
  const { body } = await f.request();
  f.fail(operation);
  expect(await f.request({ decision: "approve", csrf: body.csrf })).toEqual({
    status: 400,
    body: { error: "invalid_or_expired_interaction" },
  });
  expect(f.log.mock.calls).toEqual([
    ["OAuth consent storage unavailable", { event: "oauth_consent_storage_unavailable" }],
  ]);
  if (["Grant.find", "RecoupGrant.upsert", "Session.destroy"].includes(operation))
    expect(f.store.revokeGrant).toHaveBeenCalledOnce();
});

it("keeps denial, expired tickets, replay, and invalid identity separate from storage outages", async () => {
  const f = fixture();
  const { body } = await f.request();
  expect((await f.request({ decision: "deny", csrf: body.csrf })).status).toBe(200);
  expect((await f.request({ decision: "approve", csrf: body.csrf })).status).toBe(400);
  expect((await f.request({ decision: "approve", csrf: "x".repeat(43) })).status).toBe(400);
  f.resolveIdentity.mockRejectedValue(new Error("OAuth storage unavailable"));
  expect((await f.request()).status).toBe(400);
  expect(f.log).not.toHaveBeenCalled();
});

it("does not turn an arbitrary provider exception into a storage outage", async () => {
  const f = fixture();
  f.provider.interactionDetails.mockRejectedValue(new Error("private session expired"));
  expect((await f.request()).status).toBe(400);
  expect(f.log).not.toHaveBeenCalled();
});

it("reports storage failure during denial completion", async () => {
  const f = fixture();
  const { body } = await f.request();
  f.fail("Session.destroy");
  expect((await f.request({ decision: "deny", csrf: body.csrf })).status).toBe(400);
  expect(f.log.mock.calls).toEqual([
    ["OAuth consent storage unavailable", { event: "oauth_consent_storage_unavailable" }],
  ]);
});

it("reports cleanup storage failure without exposing the original approval exception", async () => {
  const f = fixture();
  const { body } = await f.request();
  f.provider.interactionResult.mockRejectedValue(new Error("private provider detail"));
  f.fail("Grant.revoke");
  expect((await f.request({ decision: "approve", csrf: body.csrf })).status).toBe(400);
  expect(f.store.revokeGrant).toHaveBeenCalledOnce();
  expect(f.log.mock.calls).toEqual([
    ["OAuth consent storage unavailable", { event: "oauth_consent_storage_unavailable" }],
  ]);
});

it("preserves cleanup and stays quiet on expected provider rejection after approval", async () => {
  const f = fixture();
  const { body } = await f.request();
  f.provider.interactionResult.mockRejectedValue(
    Object.assign(new Error("session expired"), { error: "invalid_request" }),
  );
  expect((await f.request({ decision: "approve", csrf: body.csrf })).status).toBe(400);
  expect(f.store.revokeGrant).toHaveBeenCalledOnce();
  expect(f.log).not.toHaveBeenCalled();
});

it("does not issue a selected ticket until a workspace is chosen and rechecks membership at approval", async () => {
  const f = fixture();
  f.details.params.scope = "mcp:tools";
  const choices = await f.request(undefined, "?consent_version=2");
  expect(choices.status).toBe(200);
  expect(choices.body.csrf).toBeUndefined();
  expect(choices.body.workspaces).toHaveLength(2);
  const org = "00000000-0000-4000-8000-000000000002";
  const preview = await f.request(
    undefined,
    `?consent_version=2&workspace_kind=organization&organization_id=${org}`,
  );
  expect(preview.status).toBe(200);
  expect(preview.body.csrf).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]{43}$/));
  membership.allowed = false;
  expect(
    (
      await f.request({
        decision: "approve",
        csrf: preview.body.csrf,
        consent_version: 2,
        workspace_kind: "organization",
        organization_id: org,
      })
    ).status,
  ).toBe(400);
  expect(f.provider.interactionResult).not.toHaveBeenCalled();
  expect(f.store.revokeGrant).not.toHaveBeenCalled();
});
it("revokes only the newly created selected grant on attribution write failure", async () => {
  const f = fixture();
  f.details.params.scope = "mcp:tools";
  const preview = await f.request(undefined, "?consent_version=2&workspace_kind=personal");
  expect(preview.status).toBe(200);
  f.fail("RecoupGrant.upsert");
  expect(
    (
      await f.request({
        decision: "approve",
        csrf: preview.body.csrf,
        consent_version: 2,
        workspace_kind: "personal",
      })
    ).status,
  ).toBe(400);
  expect(f.store.revokeGrant).toHaveBeenCalledOnce();
  expect(f.provider.interactionResult).not.toHaveBeenCalled();
});

it("allows ticket-bound denial after selected workspace membership is lost", async () => {
  const f = fixture();
  f.details.params.scope = "mcp:tools";
  const org = "00000000-0000-4000-8000-000000000002";
  const preview = await f.request(
    undefined,
    `?consent_version=2&workspace_kind=organization&organization_id=${org}`,
  );
  expect(preview.body.csrf).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]{43}$/));
  membership.allowed = false;
  const body = {
    decision: "deny",
    csrf: preview.body.csrf,
    consent_version: 2,
    workspace_kind: "organization",
    organization_id: org,
  };
  expect(
    (await f.request({ ...body, organization_id: "00000000-0000-4000-8000-000000000003" })).status,
  ).toBe(400);
  expect((await f.request(body)).status).toBe(200);
  expect(f.provider.interactionResult).toHaveBeenCalledWith(
    expect.anything(),
    expect.anything(),
    { error: "access_denied" },
    { mergeWithLastSubmission: false },
  );
  expect((await f.request(body)).status).toBe(400);
  expect(f.store.revokeGrant).not.toHaveBeenCalled();
});

it("keeps co-requested limited scope descriptions distinct in selected consent", async () => {
  const f = fixture();
  f.details.params.scope = "mcp:read mcp:write mcp:tools";
  const preview = await f.request(undefined, "?consent_version=2&workspace_kind=personal");
  expect(preview.status).toBe(200);
  expect(preview.body.permissions).toEqual([
    {
      scope: "mcp:read",
      description: "Read your personal artist profiles, social profiles, and chat list",
    },
    { scope: "mcp:write", description: "Create personal artists and update their profiles" },
    { scope: "mcp:tools", description: expect.stringContaining("one selected workspace") },
  ]);
});
