import { expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerCatalogCaseTools } from "@/lib/mcp/tools/context/registerCatalogCaseTools";
import { handleContextToolOperation } from "@/lib/mcp/tools/context/handleContextToolOperation";
import { catalogCaseToolOperations } from "../catalogCaseToolOperations";

vi.mock("@/lib/mcp/tools/context/handleContextToolOperation", () => ({
  handleContextToolOperation: vi.fn(),
}));

it("discovers standard catalog annotations without executing handlers or granting delegation", async () => {
  const server = new McpServer({ name: "catalog-annotations-test", version: "1" });
  registerCatalogCaseTools(server);
  const client = new Client({ name: "test", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  await client.connect(ct);
  try {
    const { tools } = await client.listTools();
    const expected: Record<string, [boolean, boolean, boolean]> = {
      prepare_catalog_audit: [true, false, false],
      save_catalog_case: [false, true, false],
      read_catalog_case: [true, false, false],
      list_catalog_cases: [true, false, false],
    };
    expect(tools.map(tool => tool.name).sort()).toEqual(Object.keys(expected).sort());
    for (const tool of tools) {
      const [readOnlyHint, destructiveHint, openWorldHint] = expected[tool.name];
      expect(tool.annotations, tool.name).toMatchObject({
        readOnlyHint,
        destructiveHint,
        openWorldHint,
      });
      expect(tool.inputSchema.properties).not.toHaveProperty("account_id");
    }
    for (const operation of Object.values(catalogCaseToolOperations)) {
      expect(operation.delegated).toBe(false);
    }
    expect(handleContextToolOperation).not.toHaveBeenCalled();
  } finally {
    await client.close();
    await server.close();
  }
});
