import { describe, expect, it } from "vitest";
import { catalogReportIntentSchema } from "../catalogReportIntent";
const intent = {
  kind: "catalog_weekly_report",
  catalog_id: "11111111-1111-4111-8111-111111111111",
  organization_id: null,
};
describe("internal catalog report intent", () => {
  it("requires explicit personal or organization scope", () => {
    expect(catalogReportIntentSchema.parse(intent)).toEqual(intent);
    expect(
      catalogReportIntentSchema.safeParse({
        ...intent,
        organization_id: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
    const { organization_id: _, ...missing } = intent;
    expect(catalogReportIntentSchema.safeParse(missing).success).toBe(false);
  });
  it.each([
    "actor_id",
    "actorAccountId",
    "account_id",
    "accountId",
    "prompt",
    "artist_account_id",
    "artistId",
    "schedule",
  ])("rejects client %s instead of stripping it", key => {
    expect(catalogReportIntentSchema.safeParse({ ...intent, [key]: "untrusted" }).success).toBe(
      false,
    );
  });
  it.each([
    { catalog_id: "invalid" },
    { catalog_id: null },
    { organization_id: "" },
    { kind: "artist_weekly_report" },
  ])("rejects invalid identity %s", override => {
    expect(catalogReportIntentSchema.safeParse({ ...intent, ...override }).success).toBe(false);
  });
});
