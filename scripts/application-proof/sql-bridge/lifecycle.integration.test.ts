import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fixtureSql } from "./fixtureSql";
import { createLocalApplicationFlow } from "./createLocalApplicationFlow";
import { rehearseConfigurationInvocation } from "../rehearseConfigurationInvocation";
import { invokeConfigurationSqlFixture } from "./invokeConfigurationSqlFixture";

vi.mock("@/lib/organizations/validateOrganizationAccess", () => ({
  validateOrganizationAccess: vi.fn(() => {
    throw new Error("Organization access must not run");
  }),
}));

const alice = "10000000-0000-4000-8000-000000000001";
const bob = "10000000-0000-4000-8000-000000000002";
const input = (environment = "production") => ({
  name: "Local example",
  environment,
  allowed_origins: ["https://music.example"],
  return_urls: ["https://music.example/done"],
});
describe.skipIf(!process.env.RECOUP_PROOF_BRIDGE_SOCKET)(
  "local registration to proof status",
  () => {
    beforeEach(() => {
      fixtureSql(
        "TRUNCATE proof_parent_fixture.workspaces,proof_parent_fixture.authority CASCADE;",
      );
      fixtureSql(
        readFileSync(
          join(process.env.RECOUP_PROOF_BRIDGE_SOCKET!, "fixture-authority.sql"),
          "utf8",
        ),
      );
    });
    it("registers, issues, verifies synthetic split TXT, reads history and revokes without activation", async () => {
      const flow = createLocalApplicationFlow([alice]);
      const app = await flow.register(alice, input());
      expect(app).toMatchObject({
        workspace_id: alice,
        billing_owner_id: alice,
        production_persisted: false,
      });
      const target = {
        actor: alice,
        application: app.application_id,
        environment: "production" as const,
        origin: "https://music.example",
      };
      expect(flow.status(target).receipts).toEqual([]);
      const issued = flow.prepareIssue(target, "issue-1");
      const issueReceipt = flow.replay(issued.request);
      const txt = "recoup-app-v1=" + issued.nonce;
      const verified = flow.prepareSyntheticVerification(
        target,
        "verify-1",
        issueReceipt.challenge_id,
        [[txt.slice(0, 20), txt.slice(20)]],
      );
      expect(flow.replay(verified)).toMatchObject({
        operation: "verify",
        access_activated: false,
        bootstrap_enabled: false,
      });
      const original = flow.replay(verified);
      expect(flow.replay(verified)).toEqual(original);
      expect(flow.status(target).receipts).toHaveLength(2);
      flow.replay(flow.prepareRevoke(target, "revoke-1"));
      const status = flow.status(target);
      expect(status.snapshot.origins[0].revoked).toBe(true);
      expect(status.receipts).toHaveLength(3);
      expect(() => flow.replay(flow.prepareIssue(target, "issue-2").request)).toThrow(
        "origin revoked",
      );
    });
    it("isolates two personal accounts and environments even for the same origin", async () => {
      const flow = createLocalApplicationFlow([alice, bob]);
      const a = await flow.register(alice, input());
      const b = await flow.register(bob, input("development"));
      expect(a.application_id).not.toBe(b.application_id);
      const target = {
        actor: alice,
        application: a.application_id,
        environment: "production" as const,
        origin: "https://music.example",
      };
      expect(() => flow.status({ ...target, actor: bob })).toThrow();
      expect(() => flow.status({ ...target, environment: "development" })).toThrow();
      expect(
        flow.status({
          ...target,
          actor: bob,
          application: b.application_id,
          environment: "development",
        }).receipts,
      ).toEqual([]);
    });
    it("denies absent enrollment, organization overrides and real hostnames before creating parents", async () => {
      await expect(createLocalApplicationFlow().register(alice, input())).rejects.toThrow();
      const flow = createLocalApplicationFlow([alice]);
      await expect(flow.register(alice, { ...input(), organization_id: alice })).rejects.toThrow();
      await expect(
        flow.register(alice, {
          ...input(),
          allowed_origins: ["https://recoupable.dev"],
          return_urls: ["https://recoupable.dev/done"],
        }),
      ).rejects.toThrow();
      expect(fixtureSql("SELECT count(*) FROM proof_parent_fixture.applications;")).toBe("0");
    });
    it("rolls back parent creation on failure and preserves default SQL authority denial", async () => {
      const flow = createLocalApplicationFlow([alice]);
      fixtureSql(
        "ALTER TABLE proof_parent_fixture.applications ADD CONSTRAINT reject_local_name CHECK(name <> 'rollback');",
      );
      try {
        await expect(flow.register(alice, { ...input(), name: "rollback" })).rejects.toThrow();
        expect(fixtureSql("SELECT count(*) FROM proof_parent_fixture.workspaces;")).toBe("0");
      } finally {
        fixtureSql(
          "ALTER TABLE proof_parent_fixture.applications DROP CONSTRAINT reject_local_name;",
        );
      }
      const app = await flow.register(alice, input());
      fixtureSql(
        readFileSync(
          join(process.env.RECOUP_PROOF_BRIDGE_SOCKET!, "default-authority.sql"),
          "utf8",
        ),
      );
      expect(() =>
        flow.status({
          actor: alice,
          application: app.application_id,
          environment: "production",
          origin: "https://music.example",
        }),
      ).toThrow("management authority unavailable");
    });
    it("composes existing return-URL changes with proof and rejects a prepared stale observation", async () => {
      const flow = createLocalApplicationFlow([alice]);
      const app = await flow.register(alice, input());
      const target = {
        actor: alice,
        application: app.application_id,
        environment: "production" as const,
        origin: "https://music.example",
      };
      const issued = flow.prepareIssue(target, "issue");
      const issueReceipt = flow.replay(issued.request);
      const verification = flow.prepareSyntheticVerification(
        target,
        "verify",
        issueReceipt.challenge_id,
        [["recoup-app-v1=" + issued.nonce]],
      );
      await rehearseConfigurationInvocation(
        alice,
        app.application_id,
        { ...input(), return_urls: ["https://music.example/changed"] },
        {
          authorizeFixture: async scope => ({ kind: "fixture-only-authority", scope }),
          readFixtureSnapshot: async () => flow.status(target).snapshot,
          invokeFixture: async plan =>
            (await invokeConfigurationSqlFixture(plan, "configure", async sql => fixtureSql(sql)))
              .acknowledgment,
        },
      );
      expect(flow.status(target).snapshot.return_urls).toEqual(["https://music.example/changed"]);
      expect(() => flow.replay(verification)).toThrow("revision conflict");
      expect(flow.status(target).receipts).toHaveLength(1);
    });
    it("rejects split records, stale revisions, expired challenges and revoked authority", async () => {
      const flow = createLocalApplicationFlow([alice]);
      const app = await flow.register(alice, input());
      const target = {
        actor: alice,
        application: app.application_id,
        environment: "production" as const,
        origin: "https://music.example",
      };
      const issued = flow.prepareIssue(target, "issue");
      const issueReceipt = flow.replay(issued.request);
      const txt = "recoup-app-v1=" + issued.nonce;
      expect(() =>
        flow.prepareSyntheticVerification(target, "verify", issueReceipt.challenge_id, [
          [txt.slice(0, 20)],
          [txt.slice(20)],
        ]),
      ).toThrow();
      fixtureSql(
        "UPDATE application_proof_proposal.challenges SET expires_at=issued_at+interval '1 microsecond';",
      );
      expect(() =>
        flow.prepareSyntheticVerification(target, "expired", issueReceipt.challenge_id, [[txt]]),
      ).toThrow();
      const revoked = flow.prepareRevoke(target, "revoke");
      flow.replay(revoked);
      expect(() =>
        flow.replay({
          ...revoked,
          key: "stale",
          operation: "issue",
          payload: issued.request.payload,
        }),
      ).toThrow();
      fixtureSql("UPDATE proof_parent_fixture.authority SET enabled=false;");
      expect(() => flow.status(target)).toThrow("management authority unavailable");
      expect(() => flow.replay(issued.request)).toThrow("management authority unavailable");
    });
  },
);
