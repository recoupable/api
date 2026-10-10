import { describe, expect, it, vi } from "vitest";
import { contextOperationSchema, processContextOperation } from "../processContextOperation";
import {
  formerRosterRelationship,
  listInput,
  listParams,
  recordInput,
  recordParams,
  relationshipActor as actor,
  relationshipOwner as owner,
  relationshipPage,
  relationshipReceipt,
  rosterArtist,
  workspaceDistributionRelationship,
} from "./companyRelationshipFixture";
// Isolate module initialization from hosted Supabase credentials; tests inject authorization.
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const cursor = "33333333-3333-4333-8333-333333333333";
const supersededRow = "88888888-8888-4888-8888-888888888888";
const lowerSubject = "abcdef12-3456-4789-8abc-def123456789";
const upperSubject = lowerSubject.toUpperCase();
const workspaceInput = {
  action: "record_company_relationship",
  organization_id: owner,
  company_subject_id: recordInput.company_subject_id,
  counterparty: { kind: "workspace" },
  relationship_kind: "distribution",
  status: "current",
  idempotency_key: "distribution-v1",
};
const workspaceReceipt = {
  ...relationshipReceipt,
  relationship: workspaceDistributionRelationship,
};
const cases = [
  [recordInput, relationshipReceipt, "record_context_company_relationship", recordParams],
  [
    workspaceInput,
    workspaceReceipt,
    "record_context_company_relationship",
    {
      ...recordParams,
      p_counterparty: { kind: "workspace" },
      p_kind: "distribution",
      p_status: "current",
      p_started_on: null,
      p_ended_on: null,
      p_note: "",
      p_key: "distribution-v1",
      p_supersedes: null,
    },
  ],
  [
    { ...recordInput, supersedes_id: supersededRow },
    {
      ...relationshipReceipt,
      relationship: { ...formerRosterRelationship, supersedes_id: supersededRow },
    },
    "record_context_company_relationship",
    { ...recordParams, p_supersedes: supersededRow },
  ],
  // PostgreSQL echoes canonical lowercase UUIDs; valid uppercase input must not turn a commit into a failure.
  [
    { ...recordInput, company_subject_id: upperSubject },
    {
      ...relationshipReceipt,
      relationship: { ...formerRosterRelationship, company_subject_id: lowerSubject },
    },
    "record_context_company_relationship",
    { ...recordParams, p_company_subject: upperSubject },
  ],
  [
    { ...listInput, company_subject_id: upperSubject },
    {
      ...relationshipPage,
      company_subject_id: lowerSubject,
      items: relationshipPage.items.map(item => ({ ...item, company_subject_id: lowerSubject })),
    },
    "list_context_company_relationships",
    { ...listParams, p_company_subject: upperSubject },
  ],
  [listInput, relationshipPage, "list_context_company_relationships", listParams],
  [
    { ...listInput, after_id: cursor },
    relationshipPage,
    "list_context_company_relationships",
    { ...listParams, p_after: cursor },
  ],
] as const;
function dependencies(result: unknown) {
  return {
    rpc: vi.fn(async () => result),
    dispatch: vi.fn(),
    dispatchRelease: vi.fn(),
    dispatchReleaseTracks: vi.fn(),
    authorize: vi.fn(async () => ({ accountId: actor, ownerId: owner, organizationId: owner })),
  };
}
describe("company business relationships", () => {
  it.each(cases)(
    "asserts or lists %j through scoped storage only",
    async (input, result, name, params) => {
      const deps = dependencies(result);
      expect(await processContextOperation(actor, input, deps)).toEqual(result);
      expect(deps.authorize).toHaveBeenCalledWith(actor, owner);
      expect(deps.rpc).toHaveBeenCalledExactlyOnceWith(name, params);
      expect(deps.dispatch).not.toHaveBeenCalled();
      expect(deps.dispatchRelease).not.toHaveBeenCalled();
      expect(deps.dispatchReleaseTracks).not.toHaveBeenCalled();
    },
  );
  it("denies before storage when membership is revoked", async () => {
    const deps = dependencies(relationshipReceipt);
    deps.authorize.mockRejectedValue(new Error("Access denied"));
    await expect(processContextOperation(actor, recordInput, deps)).rejects.toThrow(
      "Access denied",
    );
    expect(deps.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { ...recordInput, counterparty: { kind: "artist_account" } },
    { ...recordInput, counterparty: { kind: "professional", artist_id: rosterArtist } },
    { ...recordInput, counterparty: { kind: "workspace", artist_id: rosterArtist } },
    { ...recordInput, counterparty: { kind: "label" } },
    { ...recordInput, relationship_kind: "owner" },
    { ...recordInput, status: "active" },
    { ...recordInput, status: "current" },
    { ...recordInput, started_on: "2021-01-01" },
    { ...recordInput, ended_on: "yesterday" },
    { ...recordInput, note: "x".repeat(2001) },
    { ...recordInput, idempotency_key: "bad key" },
    { ...recordInput, supersedes_id: "not-a-row" },
    { ...recordInput, account_id: actor },
    { ...recordInput, ownership_share: 0.5 },
    (({ idempotency_key: _key, ...rest }) => rest)(recordInput),
    (({ company_subject_id: _subject, ...rest }) => rest)(listInput),
    { ...listInput, after_id: "invalid" },
    { ...listInput, limit: 10 },
  ])("rejects %j before authorization or storage", async value => {
    const deps = dependencies(relationshipReceipt);
    expect(contextOperationSchema.safeParse(value).success).toBe(false);
    await expect(processContextOperation(actor, value, deps)).rejects.toThrow();
    expect(deps.authorize).not.toHaveBeenCalled();
    expect(deps.rpc).not.toHaveBeenCalled();
  });
  it.each([
    [recordInput, null],
    [recordInput, { ...relationshipReceipt, gaps: [] }],
    [
      recordInput,
      {
        ...relationshipReceipt,
        relationship: { ...formerRosterRelationship, company_subject_id: owner },
      },
    ],
    [
      recordInput,
      {
        ...relationshipReceipt,
        relationship: { ...formerRosterRelationship, ownership_share: 0.5 },
      },
    ],
    [
      recordInput,
      { ...relationshipReceipt, relationship: { ...formerRosterRelationship, basis: "verified" } },
    ],
    [
      recordInput,
      {
        ...relationshipReceipt,
        relationship: (({ superseded_by: _later, ...rest }) => rest)(formerRosterRelationship),
      },
    ],
    [
      listInput,
      { ...relationshipPage, items: [{ ...formerRosterRelationship, superseded_by: "later" }] },
    ],
    [listInput, { ...relationshipPage, coverage: "complete" }],
    [listInput, { ...relationshipPage, company_subject_id: actor }],
    [
      listInput,
      { ...relationshipPage, items: [{ ...formerRosterRelationship, status: "active" }] },
    ],
    [
      listInput,
      { ...relationshipPage, items: [{ ...formerRosterRelationship, company_subject_id: owner }] },
    ],
  ])("rejects malformed or wrong-scope storage output for %j", async (input, result) => {
    const deps = dependencies(result);
    await expect(processContextOperation(actor, input, deps)).rejects.toThrow();
    expect(deps.rpc).toHaveBeenCalledTimes(1);
  });
});
