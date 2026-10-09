import { recoupIcons } from "../../recoupIcons";
import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerRecoupExtension } from "../registerRecoupExtension";

describe("Recoup extension protocol", () => {
  it("discovers sidebar and conversation entrypoints and serves a self-contained UI", async () => {
    const server = new McpServer({ name: "test", version: "1", icons: recoupIcons });
    registerRecoupExtension(server);
    const client = new Client({ name: "test", version: "1" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    try {
      const { tools } = await client.listTools();
      const open = tools.find(tool => tool.name === "open_recoup");
      expect(client.getServerVersion()?.icons).toEqual([
        {
          src: "https://api.recoupable.dev/recoup-extension-icon.svg",
          mimeType: "image/svg+xml",
          sizes: ["20x20"],
        },
      ]);
      expect(open?._meta?.["openai/ui"]).toMatchObject({
        entrypoints: [{ type: "global" }, { type: "thread" }],
      });
      expect(open?._meta?.ui).toMatchObject({ resourceUri: "ui://recoup/explore.html" });
      const result = await client.callTool({ name: "open_recoup", arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ title: "Recoup", version: 1 });
      const resource = await client.readResource({ uri: "ui://recoup/explore.html" });
      expect(resource.contents[0].mimeType).toBe("text/html;profile=mcp-app");
      expect(resource.contents[0].text).toContain("Make cover art");
      expect(resource.contents[0]._meta?.ui).toMatchObject({
        csp: { connectDomains: [], resourceDomains: ["https://d8j0ntlcm91z4.cloudfront.net"] },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
