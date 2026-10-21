import { writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { buildContextOperationCatalog } from "../buildContextOperationCatalog";

vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
const catalog = buildContextOperationCatalog();
const requestSchema = catalog.requestSchemas.find(
  schema => (schema.properties?.action as { const?: string })?.const === "plan_catalog_members",
);

if (process.env.RECOUP_CONTEXT_CATALOG_PLANNING_OUTPUT)
  writeFileSync(
    process.env.RECOUP_CONTEXT_CATALOG_PLANNING_OUTPUT,
    JSON.stringify(
      {
        requestSchema,
        responseSchema: catalog.responseSchemas.catalogPlanning,
        responseReference: catalog.responseReferences.plan_catalog_members,
        mcpOperation: catalog.mcpOperations.plan_catalog_members,
      },
      null,
      2,
    ) + "\n",
  );

it("exports all six planning inputs and the existing read-only MCP operation", () => {
  expect(catalog.undocumentedActions).not.toContain("plan_catalog_members");
  expect(requestSchema?.properties?.module).toMatchObject({
    enum: [
      "recording_candidates",
      "recording_work_candidates",
      "platform_metadata",
      "musicbrainz",
      "mlc_recording",
      "songstats",
    ],
  });
  expect(catalog.mcpOperations.plan_catalog_members).toEqual({
    name: "plan_music_catalog_research",
    readOnly: true,
  });
});

it("exports the complete response, including page, plan IDs, and collection prohibition", () => {
  const response = catalog.responseSchemas.catalogPlanning;
  expect(catalog.responseReferences.plan_catalog_members).toBe("#/responseSchemas/catalogPlanning");
  expect(response.required).toEqual(["page", "plan", "collectionPermitted"]);
  expect(response.additionalProperties).toBe(false);
  expect(response.properties?.collectionPermitted).toEqual({ type: "boolean", const: false });
  const page = response.properties?.page as { required: string[] };
  expect(page.required).toEqual([
    "catalogId",
    "catalogSubjectId",
    "members",
    "nextCursor",
    "hasMore",
  ]);
  const plan = response.properties?.plan as {
    items: { required: string[]; properties: Record<string, unknown> };
  };
  expect(plan.items.required).toEqual([
    "key",
    "entry",
    "subjectId",
    "targetKind",
    "module",
    "executor",
    "state",
    "reasons",
    "dependsOn",
    "scope",
    "executionStarted",
  ]);
  expect(plan.items.properties.module).toMatchObject({
    enum: ["musicbrainz", "mlc_recording", "songstats"],
  });
  expect(plan.items.properties.state).toEqual({ type: "string", const: "blocked" });
  expect(plan.items.properties.executionStarted).toEqual({ type: "boolean", const: false });
});
