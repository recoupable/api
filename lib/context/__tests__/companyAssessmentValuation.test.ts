import { expect, it } from "vitest";
import { compileContextBrief } from "../compileContextBrief";
import type { ContextBriefDocument } from "../selectContextDocuments";

const owner = "11111111-1111-4111-8111-111111111111";
const request = "22222222-2222-4222-8222-222222222222";
const company = "33333333-3333-4333-8333-333333333333";
const catalog = "44444444-4444-4444-8444-444444444444";
const source = "55555555-5555-4555-8555-555555555555";
const companyDocument: ContextBriefDocument = {
  id: "66666666-6666-4666-8666-666666666666",
  ownerId: owner,
  subjectId: company,
  topic: "company_input",
  version: 1,
  status: "accepted",
  evidenceKind: "customer_assertion",
  text: "Submitted name: Example Records. Identity unconfirmed.",
  sourceVersionIds: [source],
  coverage: "partial",
};
const valuation: ContextBriefDocument = {
  id: "77777777-7777-4777-8777-777777777777",
  ownerId: owner,
  subjectId: catalog,
  topic: "catalog_valuation",
  version: 1,
  status: "accepted",
  evidenceKind: "estimate",
  text: "Modeled master-catalog band in USD from a lifetime-average stream run rate; revenueBasis: modeled_estimate; observedRevenue: not_collected; scope: workspace_private.",
  sourceVersionIds: [source],
  coverage: "partial",
};
const compile = (documents: ContextBriefDocument[]) =>
  compileContextBrief({
    ownerId: owner,
    requests: [{ id: request, subjectIds: [company, catalog] }],
    documents,
    purpose: "company_onboarding",
    maxCharacters: 12000,
  });

it("surfaces a saved catalog valuation in the assessment as a labeled estimate", () => {
  const result = compile([companyDocument, valuation]);
  expect(result.documents).toContainEqual(valuation);
  expect(result.text).toContain(`## catalog valuation — ${catalog}`);
  expect(result.text).toContain("Coverage: partial; evidence: estimate");
  expect(result.text).toContain("observedRevenue: not_collected");
  // Existing topics keep their order; valuation is appended after them.
  expect(result.text.indexOf("## company input")).toBeLessThan(
    result.text.indexOf("## catalog valuation"),
  );
  expect(result.missingTopics).not.toContain("catalog_valuation");
  expect(result.request_coverage).toContainEqual(
    expect.objectContaining({
      requestId: request,
      missingTopics: expect.not.arrayContaining(["catalog_valuation"]),
    }),
  );
  expect(result.input_manifest.excludedTopics).toEqual([]);
  expect(result.input_manifest.documents).toContainEqual(
    expect.objectContaining({ documentId: valuation.id, topic: "catalog_valuation" }),
  );
});

it("reports catalog valuation as missing assessment coverage when no estimate was saved", () => {
  const result = compile([companyDocument]);
  expect(result.missingTopics).toContain("catalog_valuation");
  expect(result.next_steps).toContainEqual({
    requestId: request,
    action: "review_assessment_coverage",
    topics: expect.arrayContaining(["catalog_valuation"]),
  });
  expect(result.gaps).toContainEqual({
    requestId: request,
    topic: "catalog_valuation",
    subjectId: null,
    status: "unavailable",
    reason: "No eligible context fits this brief.",
  });
});

it("excludes a withdrawn valuation estimate and keeps the topic missing", () => {
  const result = compile([companyDocument, { ...valuation, status: "withdrawn" }]);
  expect(result.documents).toEqual([companyDocument]);
  expect(result.text).not.toContain("modeled_estimate");
  expect(result.missingTopics).toContain("catalog_valuation");
});
