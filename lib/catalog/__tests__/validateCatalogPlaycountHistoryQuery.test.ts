import { describe, it, expect } from "vitest";
import { catalogPlaycountHistoryQuerySchema } from "../validateCatalogPlaycountHistoryQuery";

const input = { catalog_id: "740d5050-40ec-4892-a040-b78bb50fef2f", since: "2026-09-03", days: 2 };
describe("catalogPlaycountHistoryQuerySchema", () => {
  it("defaults to bounded pagination", () => {
    expect(catalogPlaycountHistoryQuerySchema.parse(input)).toMatchObject({ page: 1, limit: 25 });
  });
  it.each([
    { since: "2026-02-30" },
    { since: "not-a-date" },
    { days: 0 },
    { days: 32 },
    { limit: 26 },
    { page: 0 },
    { account_id: input.catalog_id },
    { organization_id: input.catalog_id },
  ])("rejects invalid dates, unbounded work and identity overrides: %j", change => {
    expect(catalogPlaycountHistoryQuerySchema.safeParse({ ...input, ...change }).success).toBe(
      false,
    );
  });
});
