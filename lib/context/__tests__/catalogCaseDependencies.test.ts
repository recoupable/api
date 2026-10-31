import { describe, expect, it, vi } from "vitest";
import { validateCatalogCaseDependencies } from "../validateCatalogCaseDependencies";
import { catalogCaseSnapshotSchema } from "../catalogCaseSnapshotSchema";
import * as graph from "../validateCatalogCaseDependencies";

describe("catalog dependency bounds", () => {
  it("reads each dependency list once even for a dense DAG", () => {
    let reads = 0;
    const records = new Map(
      Array.from({ length: 500 }, (_, index) => [
        String(index),
        {
          get depends_on() {
            reads++;
            return Array.from({ length: index }, (_, i) => String(i));
          },
        },
      ]),
    );
    const ctx = { addIssue: vi.fn() };
    validateCatalogCaseDependencies(records, ctx as never);
    expect(ctx.addIssue).not.toHaveBeenCalled();
    expect(reads).toBe(500);
  });
  it.each([
    [
      ["a", ["b"]],
      ["b", ["a"]],
    ],
    [["a", ["missing"]]],
    [["a", ["a"]]],
  ])("rejects cyclic or missing dependencies %j", (...entries) => {
    const records = new Map(
      (entries as [string, string[]][]).map(([id, depends_on]) => [id, { depends_on }]),
    );
    const ctx = { addIssue: vi.fn() };
    validateCatalogCaseDependencies(records, ctx as never);
    expect(ctx.addIssue).toHaveBeenCalled();
  });
  it("does not traverse dependencies after failing the size bound", () => {
    const spy = vi.spyOn(graph, "validateCatalogCaseDependencies");
    const result = catalogCaseSnapshotSchema.safeParse({
      schema_version: 1,
      case_id: "11111111-1111-4111-8111-111111111111",
      workspace_id: "22222222-2222-4222-8222-222222222222",
      revision: 0,
      scope: "test",
      sources: {
        s: {
          id: "s",
          version: "1",
          sha256: "a".repeat(64),
          locator: { large: "x".repeat(1048576) },
          status: "active",
        },
      },
      assessments: {},
      findings: {},
      actions: {},
      attempts: {},
      outcomes: {},
    });
    expect(result.success).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
