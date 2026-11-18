import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { authenticateProposedRegistration } from "../authenticateProposedRegistration";
import { validateProposedRegistrationActor } from "../validateProposedRegistrationActor";
import supabase from "@/lib/supabase/serverClient";
import { fixture } from "../../../../scripts/application-registration-proposal/setup";
const request = (headers: Record<string, string>) =>
  new NextRequest("https://fixture.invalid", { headers });
describe("actual nonprovisioning authentication", () => {
  it.each(["x-api-key", "authorization"])(
    "uses actual API-key hash/lookup/expiry with %s",
    async name => {
      expect(
        await authenticateProposedRegistration(
          request({ [name]: name === "authorization" ? `Bearer ${fixture.key}` : fixture.key }),
        ),
      ).toEqual({ actor: fixture.actor, workspace: fixture.actor });
      expect(fixture.queries).toEqual(["account_api_keys"]);
    },
  );
  it("uses actual Privy orchestration and existing account lookup without creation", async () => {
    expect(
      await authenticateProposedRegistration(request({ authorization: "Bearer synthetic-privy" })),
    ).toEqual({ actor: fixture.actor, workspace: fixture.actor });
    fixture.accountPresent = false;
    await expect(
      authenticateProposedRegistration(request({ authorization: "Bearer synthetic-privy" })),
    ).rejects.toBeInstanceOf(NextResponse);
    expect(fixture.queries).toEqual(["account_emails", "account_emails"]);
  });
  it("rejects missing/conflicting credentials and unknown/expired keys", async () => {
    for (const headers of [
      {},
      { "x-api-key": fixture.key, authorization: "Bearer synthetic-privy" },
      { "x-api-key": "unknown" },
    ])
      await expect(authenticateProposedRegistration(request(headers))).rejects.toBeInstanceOf(
        NextResponse,
      );
    fixture.expires = "2000-01-01T00:00:00Z";
    await expect(
      authenticateProposedRegistration(request({ "x-api-key": fixture.key })),
    ).rejects.toBeInstanceOf(NextResponse);
  });
  it("rejects invalid Privy verification before account lookup", async () => {
    fixture.privyValid = false;
    await expect(
      authenticateProposedRegistration(request({ authorization: "Bearer synthetic-privy" })),
    ).rejects.toBeInstanceOf(NextResponse);
    expect(fixture.queries).toEqual([]);
  });
  it("documents inherited malformed-expiry behavior without claiming credential validity", async () => {
    fixture.expires = "synthetic-malformed-expiry";
    expect(await authenticateProposedRegistration(request({ "x-api-key": fixture.key }))).toEqual({
      actor: fixture.actor,
      workspace: fixture.actor,
    });
  });
  it("rejects incorrect fixture lookup predicates", () => {
    expect(() =>
      supabase.from("account_api_keys").select("*").eq("account", fixture.actor),
    ).toThrow();
    expect(() =>
      supabase.from("account_emails").select("*").in("account_id", [fixture.actor]),
    ).toThrow();
    expect(() =>
      supabase.from("account_emails").select("*").in("email", ["other@example.invalid"]),
    ).toThrow();
  });
  it("rejects malformed or overridden evidence, not just UUID validity", () => {
    const base = {
      accountId: fixture.actor,
      orgId: null,
      authToken: "synthetic",
      verificationEvidence: {
        principal: {
          mechanism: "recoup_api_key",
          keyId: fixture.keyId,
          actorAccountId: fixture.actor,
        },
        effectiveAccountId: fixture.actor,
        accountAccess: { basis: "self" },
        organizationAccess: null,
        executionResources: {
          status: "unresolved",
          reason: "resource_authorization_contract_missing",
        },
      },
    };
    expect(validateProposedRegistrationActor(base)).toEqual({
      actor: fixture.actor,
      workspace: fixture.actor,
    });
    const mutations = [
      (x: any) => {
        delete x.verificationEvidence;
      },
      (x: any) => {
        x.orgId = fixture.actor;
      },
      (x: any) => {
        x.verificationEvidence.effectiveAccountId = fixture.keyId;
      },
      (x: any) => {
        x.verificationEvidence.principal.actorAccountId = fixture.keyId;
      },
      (x: any) => {
        x.verificationEvidence.accountAccess = {
          basis: "admin_membership",
          organizationId: fixture.actor,
        };
      },
      (x: any) => {
        x.verificationEvidence.organizationAccess = {
          basis: "self_organization",
          organizationId: fixture.actor,
        };
      },
      (x: any) => {
        x.verificationEvidence.principal.oauth = {};
      },
    ];
    for (const change of mutations) {
      const x = structuredClone(base);
      change(x);
      expect(() => validateProposedRegistrationActor(x)).toThrow();
    }
  });
});
