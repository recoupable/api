import { describe, expect, it } from "vitest";
import { getIngestionFailure } from "../getIngestionFailure";
describe("safe ingestion failures", () => {
  it("does not interpret inherited object properties as failure tuples", () => {
    for (const message of ["constructor", "toString", "__proto__"])
      expect(getIngestionFailure(new Error(message))).toMatchObject({
        status: 503,
        reason: "operation_unavailable",
      });
  });
  it("explains the size limit for oversized requests", () => {
    expect(getIngestionFailure(new Error("Request too large"))).toMatchObject({
      status: 413,
      message: "Ingestion size limit exceeded",
    });
  });
});
