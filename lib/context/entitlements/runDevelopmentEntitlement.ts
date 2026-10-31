import { createHash } from "node:crypto";
import { z } from "zod";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { processCatalogCaseOperation } from "../processCatalogCaseOperation";
import { catalogCaseReceiptSchema } from "../catalogCaseResponseSchemas";
import { sameCatalogUuid } from "../sameCatalogUuid";
import { calculateEntitlements } from "./calculateEntitlements";
import { developmentEntitlementSchema } from "./developmentEntitlementSchema";

const bindingSchema = z.record(
  z.string(),
  z.strictObject({ source_id: z.string(), version: z.string() }),
);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
      .join(",")}}`;
  return JSON.stringify(value);
}
function evidenceRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(evidenceRefs);
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, v]) =>
      key === "evidence_refs" && Array.isArray(v)
        ? v.filter((s): s is string => typeof s === "string")
        : evidenceRefs(v),
    );
  return [];
}
/** Proposed internal adapter only. Not registered as an HTTP or MCP operation. */
export async function runDevelopmentEntitlement(
  accountId: string,
  input: unknown,
  deps: {
    rpc: (name: string, params: Record<string, unknown>) => Promise<unknown>;
    authorize?: typeof authorizeContextOwner;
  },
) {
  if (process.env.NODE_ENV !== "development" || process.env.CATALOG_ENTITLEMENT_DEV !== "true")
    throw new Error("Development entitlement calculation disabled");
  const args = developmentEntitlementSchema.parse(input);
  const authorize = deps.authorize ?? authorizeContextOwner;
  const scope = await authorize(accountId, args.organization_id);
  const receipt = catalogCaseReceiptSchema.parse(
    await processCatalogCaseOperation(
      accountId,
      scope.ownerId,
      { action: "read_catalog_case", case_id: args.case_id, organization_id: args.organization_id },
      deps.rpc,
    ),
  );
  if (
    receipt.revision !== args.expected_revision ||
    receipt.state !== "saved" ||
    receipt.withheld_record_ids.length ||
    !receipt.snapshot_usable_for_save
  )
    throw new Error("Current complete case revision required");
  const snapshot = receipt.snapshot;
  const assessment = snapshot.assessments[args.assessment_id];
  if (
    !assessment ||
    "withheld" in assessment ||
    assessment.id !== args.assessment_id ||
    assessment.stale ||
    !["reconcile", "review_deal"].includes(assessment.stage)
  )
    throw new Error("Current calculation assessment required");
  if (assessment.depends_on?.length)
    throw new Error(
      "Calculation input must directly bind source evidence; derived dependencies are unsupported",
    );
  const data = assessment.data;
  if (!data || !("entitlement_input" in data)) throw new Error("Entitlement input unavailable");
  const bindings = bindingSchema.parse(data.entitlement_evidence_bindings);
  const evidence = [...new Set(evidenceRefs(data.entitlement_input))].sort();
  const sources = assessment.source_refs.map(ref => {
    const source = snapshot.sources[ref.source_id];
    if (
      !source ||
      "withheld" in source ||
      source.id !== ref.source_id ||
      source.status !== "active" ||
      source.stale ||
      source.version !== ref.version
    )
      throw new Error("Current retained source required");
    return { ...ref, sha256: source.sha256 };
  });
  if (!sources.length) throw new Error("Source evidence required");
  for (const ref of evidence) {
    const bound = bindings[ref];
    if (
      !bound ||
      !sources.some(s => s.source_id === bound.source_id && s.version === bound.version)
    )
      throw new Error("Unbound calculation evidence");
  }
  const result = calculateEntitlements(data.entitlement_input);
  // Access can change while reading; do not return a sensitive computed artifact after revocation.
  const current = await authorize(accountId, args.organization_id);
  if (!sameCatalogUuid(current.ownerId, scope.ownerId)) throw new Error("Context owner changed");
  return {
    kind: args.kind,
    method_version: args.method_version,
    provenance: {
      input_evidence_kind: "customer_assertion" as const,
      result_kind: "computed_from_supplied_terms" as const,
      workspace_id: scope.ownerId,
      case_id: args.case_id,
      case_revision: receipt.revision,
      assessment_id: args.assessment_id,
      input_sha256: createHash("sha256").update(canonical(data.entitlement_input)).digest("hex"),
      portable_source_commit: "c3059ef3718abe1568fe3ae7c6e1e4c9d2589e48",
      evidence_bindings: Object.fromEntries(evidence.map(ref => [ref, bindings[ref]])),
      source_refs: sources,
    },
    result,
    persisted: false as const,
    external_actions: "unsupported" as const,
  };
}
