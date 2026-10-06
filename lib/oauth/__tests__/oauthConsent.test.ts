import { expect, it, vi } from "vitest";
import type { Adapter, AdapterPayload } from "oidc-provider";
import { createOAuthConsentTickets } from "../consent/createOAuthConsentTickets";
import { validateOAuthConsentBody } from "../consent/validateOAuthConsentBody";

const binding = {
  uid: "interaction",
  accountId: "00000000-0000-4000-8000-000000000001",
  subject: "did:privy:alice",
  clientId: "agent",
  resource: "https://api.example/mcp",
  scopes: ["mcp:read", "mcp:write"],
};
function fixture() {
  const records = new Map<string, AdapterPayload>();
  const adapter: Adapter = {
    upsert: vi.fn(async (id, payload) => {
      records.set(id, payload);
    }),
    find: async id => records.get(id),
    findByUid: async () => undefined,
    findByUserCode: async () => undefined,
    consume: vi.fn(async id => {
      const record = records.get(id);
      if (!record || record.consumed) throw new Error("invalid_grant");
      record.consumed = 1;
    }),
    destroy: async id => {
      records.delete(id);
    },
    revokeByGrantId: async () => {},
  };
  return { tickets: createOAuthConsentTickets(() => adapter), adapter, records };
}
it("accepts only an explicit decision and opaque nonce", () => {
  const body = { decision: "approve", csrf: "a".repeat(43) };
  expect(validateOAuthConsentBody(body)).toEqual(body);
  for (const extra of [
    { accountId: "victim" },
    { scopes: ["mcp:delete"] },
    { decision: "yes" },
    { csrf: "" },
  ])
    expect(() => validateOAuthConsentBody({ ...body, ...extra })).toThrow();
});
it("issues distinct five-minute tickets and consumes each only once", async () => {
  const { tickets, adapter } = fixture();
  const csrf = await tickets.issue(binding);
  expect(await tickets.issue(binding)).not.toBe(csrf);
  expect(adapter.upsert).toHaveBeenCalledWith(csrf, expect.any(Object), 300);
  const results = await Promise.allSettled([
    tickets.consume(csrf, binding),
    tickets.consume(csrf, binding),
  ]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
});
it("binds approval to every identity, interaction, and permission field", async () => {
  const { tickets, adapter } = fixture();
  const csrf = await tickets.issue(binding);
  for (const change of [
    { uid: "different" },
    { accountId: "00000000-0000-4000-8000-000000000002" },
    { subject: "did:privy:bob" },
    { clientId: "other" },
    { resource: "https://other.example/mcp" },
    { scopes: ["mcp:delete"] },
  ])
    await expect(tickets.consume(csrf, { ...binding, ...change })).rejects.toThrow();
  expect(adapter.consume).not.toHaveBeenCalled();
  await tickets.consume(csrf, { ...binding, scopes: ["mcp:write", "mcp:read", "mcp:read"] });
});
it("rejects expired, malformed, and unsupported approvals", async () => {
  const { tickets, records } = fixture();
  await expect(tickets.issue({ ...binding, scopes: ["admin"] })).rejects.toThrow();
  const csrf = await tickets.issue(binding);
  records.delete(csrf);
  await expect(tickets.consume(csrf, binding)).rejects.toThrow();
  await expect(tickets.consume("invalid", binding)).rejects.toThrow();
});
