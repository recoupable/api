import { writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { contextOperationSchema } from "@/lib/context/processContextOperation";
import { buildContextOperationCatalog } from "../buildContextOperationCatalog";

vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const catalog = buildContextOperationCatalog();
if (process.env.RECOUP_CONTEXT_RESPONSES_OUTPUT)
  writeFileSync(
    process.env.RECOUP_CONTEXT_RESPONSES_OUTPUT,
    JSON.stringify(
      {
        responseSchemas: catalog.responseSchemas,
        evidenceSchemas: catalog.evidenceSchemas,
        responseReferences: catalog.responseReferences,
        responseStatusCodes: catalog.responseStatusCodes,
      },
      null,
      2,
    ) + "\n",
  );

it("resolves a success response and actual status for every supported action", () => {
  const actions = contextOperationSchema.options.map(option => option.shape.action.value).sort();
  expect(Object.keys(catalog.responseReferences).sort()).toEqual(actions);
  expect(Object.keys(catalog.responseStatusCodes).sort()).toEqual(actions);
  for (const reference of Object.values(catalog.responseReferences)) {
    const [, group, name] = reference.split("/");
    expect(["responseSchemas", "evidenceSchemas"]).toContain(group);
    const models = group === "responseSchemas" ? catalog.responseSchemas : catalog.evidenceSchemas;
    expect(models).toHaveProperty(name);
    type Branch = { type?: string; properties?: object };
    const schema = (models as Record<string, Branch & { anyOf?: Branch[]; oneOf?: Branch[] }>)[
      name
    ];
    for (const branch of schema.anyOf ?? schema.oneOf ?? [schema]) {
      expect(branch.type).toBe("object");
      expect(Object.keys(branch.properties ?? {}).length).toBeGreaterThan(0);
    }
  }
  expect(
    Object.entries(catalog.responseStatusCodes)
      .filter(([, status]) => status === 202)
      .map(([action]) => action)
      .sort(),
  ).toEqual(["ingest", "verify_release", "verify_release_tracks"]);
});

it("keeps established planning and evidence response references unchanged", () => {
  expect(catalog.responseReferences).toMatchObject({
    plan_catalog_members: "#/responseSchemas/catalogPlanning",
    attach_evidence: "#/evidenceSchemas/receipt",
    read_evidence_attachment: "#/evidenceSchemas/receipt",
    list_evidence_attachments: "#/evidenceSchemas/page",
  });
});
