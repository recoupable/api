import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import type { OpenAIUiResourceMetadata, OpenAIUiToolMetadata } from "@openai/mcp-extensions/server";
import html from "./generated-ui";

/** Public catalog only. Existing authenticated MCP tools retain all execution authorization. */
export function registerRecoupExtension(server: McpServer) {
  const uri = "ui://recoup/explore.html";
  registerAppResource(server, "Recoup Explore", uri, {}, async () => ({
    contents: [
      {
        uri,
        mimeType: RESOURCE_MIME_TYPE,
        text: html,
        _meta: {
          ui: {
            csp: { connectDomains: [], resourceDomains: ["https://d8j0ntlcm91z4.cloudfront.net"] },
          },
          "openai/ui": {
            preferredDisplayMode: "fullscreen",
            availableDisplayModes: ["inline", "fullscreen", "pip"],
          } satisfies OpenAIUiResourceMetadata,
        },
      },
    ],
  }));
  registerAppTool(
    server,
    "open_recoup",
    {
      title: "Recoup Explore",
      description:
        "Open Recoup's visual music workflow library. Explore release planning, cover art, fan experiences, lyric videos, song hooks and artist research, then start a brief in the conversation.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        ui: { resourceUri: uri },
        "openai/ui": {
          entrypoints: [{ type: "global" }, { type: "thread" }],
        } satisfies OpenAIUiToolMetadata,
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
