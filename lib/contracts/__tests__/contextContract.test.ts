import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  contextOperationSchema,
  processContextOperation,
} from "@/lib/context/processContextOperation";
import fixture from "../fixtures/published-docs.json";
import contextFixture from "../fixtures/context-contract.json";
import { buildContextOperationCatalog } from "../buildContextOperationCatalog";

vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

// Provider-bound planning remains a documented gap until its public module contract is stable.
const {
  undocumentedActions,
  requestSchemas: schemas,
  mcpOperations,
  standardMcpOperations,
  evidenceSchemas,
} = buildContextOperationCatalog();

// Optional provider-free export used to refresh the maintained OpenAPI request union.
if (process.env.RECOUP_CONTEXT_SCHEMA_OUTPUT)
  writeFileSync(process.env.RECOUP_CONTEXT_SCHEMA_OUTPUT, JSON.stringify(schemas, null, 2) + "\n");
if (process.env.RECOUP_CONTEXT_MCP_OUTPUT)
  writeFileSync(
    process.env.RECOUP_CONTEXT_MCP_OUTPUT,
    JSON.stringify(mcpOperations, null, 2) + "\n",
  );
if (process.env.RECOUP_CONTEXT_STANDARD_MCP_OUTPUT)
  writeFileSync(
    process.env.RECOUP_CONTEXT_STANDARD_MCP_OUTPUT,
    JSON.stringify(standardMcpOperations, null, 2) + "\n",
  );
if (process.env.RECOUP_CONTEXT_EVIDENCE_OUTPUT)
  writeFileSync(
    process.env.RECOUP_CONTEXT_EVIDENCE_OUTPUT,
    JSON.stringify(evidenceSchemas, null, 2) + "\n",
  );

function withoutDescriptions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutDescriptions);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "description")
        .map(([key, item]) => [key, withoutDescriptions(item)]),
    );
  return value;
}

describe("published Context request catalog", () => {
  it("maps the reference actions to the current delegated tool names and permissions", () => {
    expect(contextFixture.mcpOperations).toEqual(mcpOperations);
  });
  it("documents evidence tools separately from delegated connection capabilities", () => {
    expect(contextFixture.standardMcpOperations).toEqual(standardMcpOperations);
    expect(Object.keys(standardMcpOperations)).toEqual([
      "attach_evidence",
      "read_evidence_attachment",
      "list_evidence_attachments",
    ]);
    for (const action of Object.keys(standardMcpOperations))
      expect(mcpOperations).not.toHaveProperty(action);
  });
  it("keeps published evidence receipts and pages aligned with actual response validators", () => {
    expect(withoutDescriptions(contextFixture.evidenceSchemas)).toEqual(evidenceSchemas);
  });
  it("distinguishes accepted URL syntax from the pilot ingestion restriction", async () => {
    const accountId = "11111111-1111-4111-8111-111111111111";
    const rpc = vi.fn();
    const dispatch = vi.fn();
    const input = {
      action: "ingest",
      url: "https://youtu.be/dQw4w9WgXcQ",
      idempotency_key: "fixture",
    };
    expect(contextOperationSchema.safeParse(input).success).toBe(true);
    await expect(
      processContextOperation(accountId, input, {
        rpc,
        dispatch,
        authorize: async () => ({ accountId, ownerId: accountId, organizationId: null }),
      }),
    ).rejects.toThrow("Only Spotify tracks are enabled in this pilot");
    expect(rpc).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("matches every provider-neutral action and its actual request fields", () => {
    expect(withoutDescriptions(contextFixture.requestSchemas)).toEqual(schemas);
    expect(contextFixture.sourceHash).toBe(
      fixture.sourceHashes["content/docs/source/api-reference/openapi/context.json"],
    );
  });

  it("records the provider-bound planning action still missing from the reference", () => {
    expect(contextFixture.undocumentedActions).toEqual(undocumentedActions);
  });
});
