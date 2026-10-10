import { describe, expect, it } from "vitest";
import { catalogStreamHistoryQuerySchema } from "../validateCatalogStreamHistoryQuery";
const input = {
  catalog_id: "740d5050-40ec-4892-a040-b78bb50fef2f",
  since: "2024-01-01",
  days: 366,
};
describe("saved stream history query", () => {
  it.each([1, 7, 28, 90, 365, 366])("accepts bounded %s-day dates", days => {
    expect(catalogStreamHistoryQuerySchema.parse({ ...input, days })).toMatchObject({
      days,
      page: 1,
      limit: 25,
    });
  });
  it.each([
    { days: 0 },
    { days: 367 },
    { days: 2.5 },
    { since: "2024-02-30" },
    { account_id: "other" },
    { limit: 26 },
  ])("denies invalid or unbounded input %j", change => {
    expect(catalogStreamHistoryQuerySchema.safeParse({ ...input, ...change }).success).toBe(false);
  });
});
