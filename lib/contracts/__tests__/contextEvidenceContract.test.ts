import { expect, it, vi } from "vitest";
import fixture from "../fixtures/context-contract.json";
import { buildContextOperationCatalog } from "../buildContextOperationCatalog";
vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

type Schema = { description?: string; uniqueItems?: boolean; properties?: Record<string, Schema> };
const requests = new Map<string, Schema>(
  fixture.requestSchemas.map(schema => [schema.properties.action.const, schema] as const),
);
const field = (action: string, name: string) => requests.get(action)?.properties?.[name];
it("keeps published evidence schemas and guidance aligned with the actual validators", () => {
  expect(fixture.evidenceSchemas).toEqual(buildContextOperationCatalog().evidenceSchemas);
});
it("connects both evidence response schemas to the public 200 contract", () => {
  expect(fixture.evidenceResponseReferenceSource).toMatchObject({
    repository: "recoupable/marketing",
    path: "content/docs/source/api-reference/openapi/context.json",
  });
  expect(fixture.evidenceResponseReferenceSource.references).toEqual([
    "#/components/schemas/ContextEvidenceAttachmentReceipt",
    "#/components/schemas/ContextEvidenceAttachmentPage",
  ]);
});
it("resolves fixture references inside the fixture instead of treating source pointers as local", () => {
  expect(fixture.evidenceResponseReferences).toEqual(
    Object.keys(fixture.evidenceSchemas).map(name => `#/evidenceSchemas/${name}`),
  );
});
it("preserves the workspace guidance on every documented action", () => {
  for (const action of requests.keys())
    expect(field(action, "organization_id")?.description).toContain(
      "Current membership and ownership",
    );
});
it("preserves semantic limits beyond the generated request shape", () => {
  expect(field("save_brief", "max_characters")?.description).toContain("independently");
  expect(field("ingest", "url")?.description).toContain("rejects YouTube");
  expect(field("ingest_release", "url")?.description).toContain("album URL");
});
it("declares duplicate rejection and the cursor handoff", () => {
  expect(field("attach_evidence", "targets")?.uniqueItems).toBe(true);
  for (const phrase of ["next_id", "after_id", "has_more", "empty"])
    expect(field("list_evidence_attachments", "after_id")?.description).toContain(phrase);
});
