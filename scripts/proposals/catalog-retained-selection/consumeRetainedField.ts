import { z } from "zod";
import { evaluateRetainedStreamField } from "../catalog-stream-fields/evaluate";
import { actorScopeSchema, requestSchema, type ActorScope, type Selection } from "./schemas";
type Evaluated = Extract<ReturnType<typeof evaluateRetainedStreamField>, { state: "ready" }>;
type Item = {
  ref: Evaluated["ref"];
  binding: Selection;
  value: { state: "known"; amount: number } | { state: "unknown" };
  periods: Evaluated["periods"];
  coverage: {
    comparisonState: string;
    absentDateCount: number;
    nullDateCount: number;
    missingDateCount: number;
  };
  source: Pick<
    Evaluated["provenance"],
    "provider" | "metric" | "platform" | "territory" | "timezone" | "retrievalRange"
  >;
};
type Ready = Omit<z.infer<typeof requestSchema>, "mode" | "selections"> & {
  state: "ready";
  contract: "catalog-retained-field-projection/1";
  asOf: string;
  semantics: "historical_snapshot";
  items: Item[];
};
type Result = Ready | { state: "unavailable" | "error" | "invalid" };
/** Adapter MUST authenticate scope and pre-lock the complete sorted batch, keeping locks through callback evaluation.
 * No implementation or grant is supplied. Injected test ports prove plumbing only. */
export type LockedRead = (
  scope: ActorScope & { workspaceId: string; catalogId: string; selections: Selection[] },
  consume: (tx: {
    asOf: string;
    readBinding: (selection: Selection) => Promise<unknown>;
  }) => Promise<Result>,
) => Promise<Result>;
/** Inactive source consumer; no report fallback, disclosure route, transport or UI schema change. */
export async function consumeRetainedField(
  actorInput: unknown,
  input: unknown,
  withLockedRead?: LockedRead,
): Promise<Result> {
  const actor = actorScopeSchema.safeParse(actorInput),
    request = requestSchema.safeParse(input);
  if (!actor.success || !request.success) return { state: "invalid" };
  if (!withLockedRead) return { state: "unavailable" };
  const q = request.data;
  try {
    return await withLockedRead(
      {
        ...actor.data,
        workspaceId: q.workspaceId,
        catalogId: q.catalogId,
        selections: [...q.selections].sort((a, b) => a.subjectId.localeCompare(b.subjectId)),
      },
      async tx => {
        if (
          !z.iso.datetime({ offset: true }).safeParse(tx.asOf).success ||
          !Number.isFinite(Date.parse(tx.asOf))
        )
          return { state: "error" };
        const items: Item[] = [];
        for (const selection of q.selections) {
          const envelope = await tx.readBinding(selection);
          if (envelope === null || envelope === undefined) return { state: "unavailable" };
          const result = evaluateRetainedStreamField({
            operation: "read_field",
            recipe: q.method.recipe,
            field: q.field,
            selection: { ...selection, query: q.query },
            asOf: tx.asOf,
            boundary: { state: "qualified", envelope },
          });
          if (result.state !== "ready") return { state: "unavailable" };
          const amount = result.field.amount;
          if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0))
            return { state: "unavailable" };
          items.push({
            ref: result.ref,
            binding: selection,
            value: amount === null ? { state: "unknown" } : { state: "known", amount },
            periods: result.periods,
            coverage: {
              comparisonState: result.coverage.comparisonState,
              absentDateCount: result.coverage.absentDates.length,
              nullDateCount: result.coverage.nullDates.length,
              missingDateCount: result.coverage.missingDays.length,
            },
            source: {
              provider: result.provenance.provider,
              metric: result.provenance.metric,
              platform: result.provenance.platform,
              territory: result.provenance.territory,
              timezone: result.provenance.timezone,
              retrievalRange: result.provenance.retrievalRange,
            },
          });
        }
        const ready: Ready = {
          state: "ready",
          contract: "catalog-retained-field-projection/1",
          workspaceId: q.workspaceId,
          catalogId: q.catalogId,
          field: q.field,
          method: q.method,
          query: q.query,
          asOf: tx.asOf,
          semantics: "historical_snapshot",
          items,
        };
        return Buffer.byteLength(JSON.stringify(ready), "utf8") > 32768
          ? { state: "invalid" }
          : ready;
      },
    );
  } catch {
    return { state: "error" };
  }
}
