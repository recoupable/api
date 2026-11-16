import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { validateApplicationRegistration } from "../../../lib/applications/validateApplicationRegistration";
import { transition } from "../contractModel";
import { fixtureSql } from "./fixtureSql";
import { quoteFixtureSqlLiteral as quote } from "./quoteFixtureSqlLiteral";

const targetSchema = z
  .object({
    actor: z.string().uuid(),
    application: z.string().uuid(),
    environment: z.enum(["production", "development"]),
    origin: z.string().url(),
  })
  .strict();
type Target = z.infer<typeof targetSchema>;
const requestSchema = z
  .object({
    target: targetSchema,
    operation: z.enum(["issue", "verify", "revoke"]),
    key: z.string().min(1).max(128),
    config: z.number().int().positive().safe(),
    proof: z.number().int().positive().safe(),
    cas: z.number().int().positive().safe(),
    payload: z.record(z.string(), z.string()),
  })
  .strict();
type Request = z.infer<typeof requestSchema>;
const receiptSchema = z
  .object({
    receipt_id: z.string().uuid(),
    challenge_id: z.string().uuid().nullable().optional(),
    actor: z.string().uuid(),
    workspace_id: z.string().uuid(),
    application_id: z.string().uuid(),
    environment: z.enum(["production", "development"]),
    origin: z.string(),
    operation: z.enum(["issue", "verify", "revoke"]),
    recorded_at: z.iso.datetime({ offset: true }),
    config_revision: z.number().int().positive().safe(),
    proof_revision: z.number().int().positive().safe(),
    cas_revision: z.number().int().positive().safe(),
    bootstrap_enabled: z.literal(false),
    access_activated: z.literal(false),
    evidence_kind: z.literal("synthetic_observation"),
  })
  .passthrough();

/** Disposable fixture caller only. No production caller, resolver, credential or network adapter. */
export function createLocalApplicationFlow(syntheticActors: readonly string[] = []) {
  const enrolled = new Set(z.array(z.string().uuid()).parse(syntheticActors));
  const actor = (value: string) => {
    if (!enrolled.has(value)) throw new Error("Synthetic personal account not enrolled");
  };
  const scope = (value: Target) => {
    const target = targetSchema.parse(value);
    actor(target.actor);
    return target;
  };
  const binding = (t: Target) =>
    [t.actor, t.actor, t.application, t.environment].map(quote).join(",");
  const authorize = (t: Target, operation: string) =>
    `SELECT application_proof_proposal.authorize_management(${binding(t)},${quote(operation)});`;
  const status = (value: Target) => {
    const t = scope(value);
    // One transaction retains the authority row lock through the scoped read.
    const raw = fixtureSql(`BEGIN;
      ${authorize(t, "read")}
      SELECT jsonb_build_object('snapshot', application_proof_proposal.configuration_snapshot(${quote(t.actor)},${quote(t.application)},${quote(t.environment)}),
      'receipts', COALESCE((SELECT jsonb_agg(result ORDER BY recorded_at,id) FROM application_proof_proposal.receipts
        WHERE workspace_id=${quote(t.actor)} AND application_id=${quote(t.application)} AND environment=${quote(t.environment)} AND origin=${quote(t.origin)}),'[]'::jsonb));
      COMMIT;`);
    const result = JSON.parse(raw.trim());
    if (!result.snapshot?.origins?.some((o: { origin: string }) => o.origin === t.origin))
      throw new Error("Resource unavailable");
    return {
      ...result,
      production_persisted: false,
      bootstrap_enabled: false,
      access_activated: false,
    };
  };
  const replay = (value: Request) => {
    const request = requestSchema.parse(value);
    const t = scope(request.target);
    const result = receiptSchema.parse(
      JSON.parse(
        fixtureSql(
          `SELECT application_proof_proposal.transact(${binding(t)},${quote(t.origin)},${quote(request.operation)},${quote(request.key)},${request.config},${request.proof},${request.cas},${quote(JSON.stringify(request.payload))}::jsonb);`,
        ),
      ),
    );
    if (
      result.actor !== t.actor ||
      result.workspace_id !== t.actor ||
      result.application_id !== t.application ||
      result.environment !== t.environment ||
      result.origin !== t.origin ||
      result.operation !== request.operation
    )
      throw new Error("Receipt binding mismatch");
    return result;
  };
  const prepare = (
    t: Target,
    operation: Request["operation"],
    key: string,
    payload: Record<string, string>,
  ): Request => {
    const current = status(t).snapshot.origins.find(
      (o: { origin: string }) => o.origin === t.origin,
    );
    return requestSchema.parse({
      target: t,
      operation,
      key,
      config: current.config_revision,
      proof: current.proof_revision,
      cas: current.cas_revision,
      payload,
    });
  };
  return {
    async register(account: string, input: unknown) {
      actor(account);
      if (typeof input === "object" && input !== null && "organization_id" in input)
        throw new Error("Local flow is personal-only");
      const proposal = await validateApplicationRegistration(account, input);
      if (proposal.allowed_origins.some(origin => !new URL(origin).hostname.endsWith(".example")))
        throw new Error("Only reserved .example fixture hostnames are supported");
      const application = randomUUID();
      // This creates fixture parents only. Production parent mapping is deliberately absent.
      fixtureSql(`BEGIN;
        INSERT INTO proof_parent_fixture.workspaces VALUES(${quote(account)}) ON CONFLICT DO NOTHING;
        INSERT INTO proof_parent_fixture.applications(workspace_id,id,name) VALUES(${quote(account)},${quote(application)},${quote(proposal.name)});
        INSERT INTO proof_parent_fixture.environments(workspace_id,application_id,environment) VALUES(${quote(account)},${quote(application)},${quote(proposal.environment)});
        ${proposal.allowed_origins
          .map(
            origin => `INSERT INTO proof_parent_fixture.origins(workspace_id,application_id,environment,origin,hostname,return_urls)
          VALUES(${quote(account)},${quote(application)},${quote(proposal.environment)},${quote(origin)},${quote(new URL(origin).hostname)},ARRAY[${proposal.return_urls
            .filter(url => new URL(url).origin === origin)
            .map(quote)
            .join(",")}]::text[]);`,
          )
          .join("\n")}
        INSERT INTO proof_parent_fixture.authority VALUES(${quote(account)},${quote(account)},${quote(application)},${quote(proposal.environment)},ARRAY['read','issue','verify','revoke','replace_existing_origin_return_urls'],true);
        COMMIT;`);
      return {
        application_id: application,
        workspace_id: account,
        billing_owner_id: account,
        environment: proposal.environment,
        production_persisted: false,
        bootstrap_enabled: false,
        access_activated: false,
      };
    },
    status,
    replay,
    prepareIssue(t: Target, key: string) {
      const nonce = randomBytes(32).toString("base64url");
      const request = prepare(t, "issue", key, {
        digest: createHash("sha256").update(nonce).digest("hex"),
      });
      return { nonce, request };
    },
    prepareSyntheticVerification(
      t: Target,
      key: string,
      challengeId: unknown,
      records: string[][],
    ) {
      scope(t);
      const id = z.string().uuid().parse(challengeId);
      // Explicit synthetic observation. Never performs DNS or accepts a resolver URL.
      const boundedRecords = z
        .array(z.array(z.string().max(255)).max(16))
        .max(16)
        .parse(records);
      const current = status(t).snapshot.origins.find(
        (o: { origin: string }) => o.origin === t.origin,
      );
      const raw = fixtureSql(`BEGIN; ${authorize(t, "verify")}
        SELECT jsonb_build_object('digest',digest,'issued_at',issued_at,'expires_at',expires_at,'state',state,'now',clock_timestamp())
        FROM application_proof_proposal.challenges WHERE id=${quote(id)} AND workspace_id=${quote(t.actor)} AND application_id=${quote(t.application)} AND environment=${quote(t.environment)} AND origin=${quote(t.origin)};
        COMMIT;`);
      if (!raw.trim()) throw new Error("Challenge unavailable");
      const challenge = JSON.parse(raw.trim());
      if (challenge.state !== "pending") throw new Error("Challenge unavailable");
      const now = Date.parse(challenge.now);
      const query = "_recoup-app." + new URL(t.origin).hostname;
      const binding = {
        workspace: t.actor,
        application: t.application,
        environment: t.environment,
        origin: t.origin,
      };
      // Reuse the existing TXT assembly/match contract, then let actual SQL recheck at commit.
      transition(
        {
          binding,
          revision: current.cas_revision,
          revoked: current.revoked,
          pending: {
            digest: challenge.digest,
            issuedAt: Date.parse(challenge.issued_at),
            expiresAt: Date.parse(challenge.expires_at),
          },
          validUntil: null,
        },
        {
          type: "verify",
          binding,
          expectedRevision: current.cas_revision,
          authorized: true,
          now,
          observation: { name: query, records: boundedRecords, queriedAt: now, outcome: "answer" },
        },
      );
      const request = requestSchema.parse({
        target: t,
        operation: "verify",
        key,
        config: current.config_revision,
        proof: current.proof_revision,
        cas: current.cas_revision,
        payload: {
          challenge_id: id,
          digest: challenge.digest,
          query_name: query,
          queried_at: challenge.now,
          resolver_policy: "synthetic-v1",
        },
      });
      return request;
    },
    prepareRevoke(t: Target, key: string) {
      const request = prepare(t, "revoke", key, {});
      return request;
    },
  };
}
