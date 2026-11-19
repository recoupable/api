import { z } from "zod";
import { evaluateRetainedStreamField } from "../catalog-stream-fields/evaluate";
import { actorScopeSchema, requestSchema } from "./schemas";
import type { Item, Ready, Result, LockedRead } from "./retainedFieldTypes";
import { classifyRetainedFieldRefusal } from "./classifyRetainedFieldRefusal";
/** Inactive source consumer; no report fallback, disclosure route, transport or UI schema change. */
export async function consumeRetainedField(
  actorInput: unknown,
  input: unknown,
  withLockedRead?: LockedRead,
): Promise<Result> {
  const actor = actorScopeSchema.safeParse(actorInput);
  const request = requestSchema.safeParse(input);
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
          if (result.state !== "ready") return classifyRetainedFieldRefusal(result.reason);
          const comparisonState = result.coverage.comparisonState;
          if (comparisonState !== "comparable" && comparisonState !== "incomplete")
            return { state: "error" };
          const { authority, kind } = result.ref;
          if (authority !== "context" || kind !== "recording") return { state: "error" };
          const amount = result.field.amount;
          if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0))
            return { state: "unavailable" };
          items.push({
            ref: { ...result.ref, authority, kind },
            binding: selection,
            value: amount === null ? { state: "unknown" } : { state: "known", amount },
            periods: result.periods,
            coverage: {
              comparisonState,
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
