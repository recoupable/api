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
  it("reports an oversized shared-database record as a size error", () => {
    expect(getIngestionFailure(new Error("Ingestion record size limit"))).toMatchObject({
      status: 413,
      reason: "record_size_limit",
    });
  });
  it("explains the size limit for oversized requests", () => {
    expect(getIngestionFailure(new Error("Request too large"))).toMatchObject({
      status: 413,
      message: "Ingestion size limit exceeded",
    });
  });
});
