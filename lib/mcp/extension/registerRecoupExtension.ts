import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import html from "./generated-ui";

/** Public catalog only. Existing authenticated MCP tools retain all execution authorization. */
export function registerRecoupExtension(server: McpServer) {
  const uri = "ui://recoup/explore.html";
  server.registerResource(
    "Recoup",
    uri,
    { mimeType: "text/html;profile=mcp-app" },
    async () => ({
      contents: [
        {
          uri,
          mimeType: "text/html;profile=mcp-app",
          text: html,
          _meta: {
            ui: {
              csp: {
                connectDomains: [],
                resourceDomains: ["https://d8j0ntlcm91z4.cloudfront.net"],
              },
            },
            "openai/ui": {
              preferredDisplayMode: "fullscreen",
              availableDisplayModes: ["inline", "fullscreen", "pip"],
            },
          },
        },
      ],
    }),
  );
  server.registerTool(
    "open_recoup",
    {
      title: "Recoup",
      description:
        "Open Recoup's visual music workflow library. Explore release planning, cover art, fan experiences, lyric videos, song hooks and artist research, then start a brief in the conversation.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        ui: { resourceUri: uri },
        "ui/resourceUri": uri,
        "openai/ui": {
          entrypoints: [{ type: "global" }, { type: "thread" }],
        },
      },
    },
    async () => ({
      content: [
        { type: "text", text: "Explore Recoup and choose a workflow to start with your music." },
      ],
      structuredContent: { title: "Recoup", version: 1 },
    }),
  );
}
