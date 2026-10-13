import { describe, expect, it } from "vitest";
import { getSocialScrapeCreditCost } from "@/lib/socials/getSocialScrapeCreditCost";
import { validateCatalogStreamHistoryQuery } from "@/lib/catalog/validateCatalogStreamHistoryQuery";
import { createNothingToResumeResponse } from "@/lib/chat/createNothingToResumeResponse";
import { createTaskBodySchema } from "@/lib/tasks/createTaskSchemas";
import fixture from "../fixtures/published-docs.json";

describe("published contract semantics", () => {
  it("describes the actual base and per-post credit amounts", () => {
    expect(fixture.contracts.social.baseCredits).toBe(getSocialScrapeCreditCost());
    expect(fixture.contracts.social.perPostCredits).toBe(
      getSocialScrapeCreditCost(1) - getSocialScrapeCreditCost(),
    );
  });

  it("states the implemented X fetch default and required auth/error outcomes", () => {
    expect(fixture.contracts.social.twitterDefaultDepth).toBe(10);
    expect(fixture.contracts.social.security).not.toHaveLength(0);
    expect(fixture.contracts.social.responses).toEqual(
      expect.arrayContaining(["401", "403", "404", "500"]),
    );
  });

  it("documents the true catalog-history boundary", () => {
    const input = {
      catalog_id: "11111111-1111-4111-8111-111111111111",
      since: "2026-01-01",
      days: fixture.contracts.catalogDaysMaximum,
    };
    expect(validateCatalogStreamHistoryQuery(input).success).toBe(true);
    expect(validateCatalogStreamHistoryQuery({ ...input, days: input.days + 1 }).success).toBe(
      false,
    );
  });

  it("describes the actual terminal SSE response and stream failure statuses", () => {
    expect(fixture.contracts.resumeNoActiveStatus).toBe(createNothingToResumeResponse().status);
    expect(fixture.contracts.resumeResponses).toContain("502");
    expect(fixture.contracts.stopResponses).toEqual(expect.arrayContaining(["401", "502", "504"]));
  });

  it("documents optional task model selection and read-time plan blocking", () => {
    const parsed = createTaskBodySchema.parse({
      title: "Fixture",
      prompt: "Fixture only",
      schedule: "0 0 * * *",
      artist_account_id: "11111111-1111-4111-8111-111111111111",
      model: "fixture-model",
    });
    expect(fixture.contracts.taskModelType).toBe(typeof parsed.model);
    expect(fixture.contracts.taskReadResponses).toContain("402");
  });

  it("declares the callback header required by the existing handler", () => {
    expect(fixture.contracts.callbackHeader).toBe("x-callback-secret");
  });
});
