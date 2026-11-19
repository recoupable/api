import type { z } from "zod";
import type { evaluateRetainedStreamField } from "../catalog-stream-fields/evaluate";
import type { requestSchema, ActorScope, Selection } from "./schemas";
type Evaluated = Extract<ReturnType<typeof evaluateRetainedStreamField>, { state: "ready" }>;
export type Item = {
  ref: Evaluated["ref"];
  binding: Selection;
  value: { state: "known"; amount: number } | { state: "unknown" };
  periods: Evaluated["periods"];
  coverage: {
    comparisonState: "comparable" | "incomplete";
    absentDateCount: number;
    nullDateCount: number;
    missingDateCount: number;
  };
  source: Pick<
    Evaluated["provenance"],
    "provider" | "metric" | "platform" | "territory" | "timezone" | "retrievalRange"
  >;
};
export type Ready = Omit<z.infer<typeof requestSchema>, "mode" | "selections"> & {
  state: "ready";
  contract: "catalog-retained-field-projection/1";
  asOf: string;
  semantics: "historical_snapshot";
  items: Item[];
};
export type Result = Ready | { state: "unavailable" | "error" | "invalid" };
/** Adapter MUST authenticate scope and pre-lock the complete sorted batch, keeping locks through callback evaluation.
 * No implementation or grant is supplied. Injected test ports prove plumbing only. */
export type LockedRead = (
  scope: ActorScope & { workspaceId: string; catalogId: string; selections: Selection[] },
  consume: (tx: {
    asOf: string;
    readBinding: (selection: Selection) => Promise<unknown>;
  }) => Promise<Result>,
) => Promise<Result>;
