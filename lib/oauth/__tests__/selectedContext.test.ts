import { expect, it, vi } from "vitest";
import { resolveSelectedContext } from "../consent/resolveSelectedContext";
import { validateOAuthConsentBody } from "../consent/validateOAuthConsentBody";
import { authorizeContextOwner } from "@/lib/context/authorizeContextOwner";
vi.mock("@/lib/context/authorizeContextOwner", () => ({
  authorizeContextOwner: vi.fn(async (accountId, organizationId) => ({
    accountId,
    ownerId: organizationId ?? accountId,
    organizationId: organizationId ?? null,
  })),
}));
const actor = "11111111-1111-4111-8111-111111111111";
const org = "22222222-2222-4222-8222-222222222222";
it("constructs selection from authenticated actor and rechecks current Context access", async () => {
  expect(
    await resolveSelectedContext(actor, ["mcp:tools"], { workspace_kind: "personal" }),
  ).toMatchObject({
    ownerId: actor,
    organizationId: null,
    capabilityVersion: "context-workspace-v1",
  });
  expect(
    await resolveSelectedContext(actor, ["mcp:tools"], {
      workspace_kind: "organization",
      organization_id: org,
    }),
  ).toMatchObject({ ownerId: org, organizationId: org });
  expect(authorizeContextOwner).toHaveBeenLastCalledWith(actor, org);
  vi.mocked(authorizeContextOwner).mockRejectedValueOnce(new Error("revoked"));
  await expect(
    resolveSelectedContext(actor, ["mcp:tools"], {
      workspace_kind: "organization",
      organization_id: org,
    }),
  ).rejects.toThrow();
});
it("rejects limited upgrades, mismatched selection, extra authority and unknown versions", async () => {
  await expect(
    resolveSelectedContext(actor, ["mcp:read"], { workspace_kind: "personal" }),
  ).rejects.toThrow();
  for (const selection of [
    { workspace_kind: "organization" },
    { workspace_kind: "personal", organization_id: org },
    { workspace_kind: "personal", ownerId: org },
  ]) {
    await expect(resolveSelectedContext(actor, ["mcp:tools"], selection)).rejects.toThrow();
  }
  const body = {
    decision: "approve",
    csrf: "a".repeat(43),
    consent_version: 2,
    workspace_kind: "organization",
    organization_id: org,
  };
  expect(validateOAuthConsentBody(body)).toEqual(body);
  expect(() => validateOAuthConsentBody({ ...body, consent_version: 3 })).toThrow();
  expect(() => validateOAuthConsentBody({ ...body, ownerId: org })).toThrow();
});
