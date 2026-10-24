import { z } from "zod";
import { isCatalogJson } from "./isCatalogJson";

// Unconstrained JSON Schema accurately describes generic JSON extension slots.
// Runtime refinement additionally rejects non-JSON direct calls and excessive nesting.
const jsonValue = z
  .unknown()
  .refine(isCatalogJson, "Expected finite JSON with at most 100 nested levels");

const id = z
  .string()
  .min(1)
  .max(256)
  .refine(value => value.trim().length > 0, "Identifier must not be blank");
const jsonObject = z.record(z.string(), jsonValue);
const stage = z.enum([
  "audit",
  "reconcile",
  "register",
  "resolve_claims",
  "manage_delivery",
  "review_deal",
  "import",
  "explain_contract",
  "organize_publishing",
  "estimate_value",
  "check_credits",
  "check_metadata",
]);
const common = {
  id,
  data: jsonObject.optional(),
  context_refs: jsonValue.optional(),
  summary: z.string().max(32000).optional(),
  evidence_gap: z.string().max(32000).optional(),
  depends_on: z.array(id).max(1000).optional(),
  stale: z.boolean().optional(),
  stale_reasons: z.array(z.string().max(2000)).max(1000).optional(),
};
const derived = {
  ...common,
  source_refs: z.array(z.strictObject({ source_id: id, version: id })).max(1000),
  rule_version: id,
};
const source = z.strictObject({
  ...common,
  version: id,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  locator: z.union([z.string().min(1).max(32000), jsonObject]),
  status: z.enum(["active", "withdrawn"]),
  evidence_kind: id.optional(),
  context_source_version_id: z.uuid().optional(),
});
const assessment = z.strictObject({
  ...derived,
  stage,
  status: z.enum(["prepared", "in_progress", "partial", "complete", "blocked"]),
});
const finding = z.strictObject({
  ...derived,
  stage,
  status: z.enum(["open", "accepted", "resolved", "not_applicable"]),
  cause_id: id,
});
const action = z.strictObject({
  ...derived,
  stage: z.enum(["register", "resolve_claims", "manage_delivery"]),
  status: z.enum(["prepared", "authorized", "withdrawn"]),
  payload: z
    .object({
      provider: id,
      operation: id,
      account: id,
      party: id,
      subjects: z.array(id).min(1).max(1000),
      scope: jsonObject.refine(
        value => Object.keys(value).length > 0,
        "Action scope must not be empty",
      ),
      disclosure: z.array(jsonValue).max(1000),
      costs: z.array(jsonValue).max(1000),
    })
    .catchall(jsonValue),
  authorization: z
    .strictObject({
      reference: z.string().min(1).max(32000),
      payload_sha256: z.string().regex(/^[a-f0-9]{64}$/),
      valid_until: z.iso.datetime({ offset: true }),
      scope: jsonValue,
    })
    .optional(),
});
const attempt = z.strictObject({
  ...derived,
  action_id: id,
  payload_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum([
    "user_reported_sent",
    "observed_sent",
    "unknown_outcome",
    "acknowledged",
    "rejected",
  ]),
  provider_id: id.optional(),
  item_ids: z.array(id).max(1000).optional(),
  receipt_locator: jsonValue.optional(),
  raw_status: jsonValue.optional(),
});
const outcome = z.discriminatedUnion("dimension", [
  z.strictObject({
    ...derived,
    action_id: id,
    dimension: z.literal("provider_decision"),
    status: z.enum([
      "pending",
      "accepted",
      "partially_accepted",
      "rejected",
      "superseded",
      "rematched",
    ]),
    raw_status: jsonValue.optional(),
  }),
  z.strictObject({
    ...derived,
    action_id: id,
    dimension: z.literal("observed_record"),
    status: z.enum(["unchecked", "correct", "partial", "incorrect", "stale"]),
    raw_status: jsonValue.optional(),
  }),
  z.strictObject({
    ...derived,
    action_id: id,
    dimension: z.literal("financial_effect"),
    status: z.enum(["unverified", "adjustment_reported", "remitted", "bank_received", "reversed"]),
    raw_status: jsonValue.optional(),
  }),
]);
const recordSchemas = {
  sources: source,
  assessments: assessment,
  findings: finding,
  actions: action,
  attempts: attempt,
  outcomes: outcome,
};
const collections = Object.keys(recordSchemas) as (keyof typeof recordSchemas)[];
const bounded = <T extends z.ZodType>(schema: T) =>
  z
    .record(id, schema)
    .refine(records => Object.keys(records).length <= 1000, "Collection exceeds 1000 records");
const base = {
  schema_version: z.literal(1),
  case_id: z.uuid(),
  workspace_id: z.uuid(),
  revision: z.number().int().nonnegative(),
  scope: z.string().max(32000),
};

/** Portable versioned workpapers are customer assertions; this schema grants no external authority. */
export const catalogCaseSnapshotSchema = z
  .strictObject({
    ...base,
    sources: bounded(source),
    assessments: bounded(assessment),
    findings: bounded(finding),
    actions: bounded(action),
    attempts: bounded(attempt),
    outcomes: bounded(outcome),
  })
  .superRefine((snapshot, ctx) => {
    if (Buffer.byteLength(JSON.stringify(snapshot), "utf8") > 1048576)
      ctx.addIssue({ code: "custom", message: "Snapshot exceeds 1 MiB" });
    const records = new Map<string, { depends_on?: string[]; stale?: boolean }>();
    for (const collection of collections) {
      for (const [key, record] of Object.entries(snapshot[collection])) {
        if (key !== record.id || records.has(key))
          ctx.addIssue({
            code: "custom",
            path: [collection, key],
            message: "Record identifiers must match keys and be globally unique",
          });
        records.set(key, record);
        if ("source_refs" in record) {
          if (!record.source_refs.length && !record.evidence_gap)
            ctx.addIssue({
              code: "custom",
              path: [collection, key],
              message: "Empty evidence requires an explicit evidence_gap",
            });
          for (const ref of record.source_refs) {
            const evidence = snapshot.sources[ref.source_id];
            if (
              !evidence ||
              (!record.stale && (evidence.version !== ref.version || evidence.status !== "active"))
            )
              ctx.addIssue({
                code: "custom",
                path: [collection, key, "source_refs"],
                message:
                  "Reference must identify an active source version or a retained stale dependency",
              });
          }
        }
        if ("action_id" in record && !snapshot.actions[record.action_id])
          ctx.addIssue({
            code: "custom",
            path: [collection, key, "action_id"],
            message: "Attempt/outcome must reference a retained action",
          });
      }
    }
    for (const [recordId, record] of records) {
      const pending = [...(record.depends_on ?? [])];
      const seen = new Set<string>();
      while (pending.length) {
        const dependency = pending.pop()!;
        if (dependency === recordId || !records.has(dependency)) {
          ctx.addIssue({ code: "custom", message: "Missing or cyclic record dependency" });
          break;
        }
        if (!seen.has(dependency)) {
          seen.add(dependency);
          pending.push(...(records.get(dependency)?.depends_on ?? []));
        }
      }
    }
  });

const withheldSource = z.strictObject({
  id,
  version: id,
  status: z.literal("withdrawn"),
  withheld: z.literal(true),
});
const withheldRecord = z.strictObject({
  id,
  status: id,
  stale: z.literal(true),
  withheld: z.literal(true),
});
/** Redacted snapshots can be read, but are intentionally not accepted by the write schema. */
export const catalogCaseReadSnapshotSchema = z.strictObject({
  ...base,
  sources: bounded(z.union([source, withheldSource])),
  assessments: bounded(z.union([assessment, withheldRecord])),
  findings: bounded(z.union([finding, withheldRecord])),
  actions: bounded(z.union([action, withheldRecord])),
  attempts: bounded(z.union([attempt, withheldRecord])),
  outcomes: bounded(z.union([outcome, withheldRecord])),
});
