import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { McpServer as LegacyServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createRecoupServerInfo } from "../createRecoupServerInfo";
import type { McpAuthInfo } from "../verifyApiKey";
import { getRecoupSkills } from "./getRecoupSkills";
import { hasRecoupStaffSkills } from "./hasRecoupStaffSkills";

type LegacyTool = (
  args: unknown,
  extra: { authInfo?: McpAuthInfo; signal: AbortSignal },
) => CallToolResult | Promise<CallToolResult>;

/** Use the existing tool registrations and authorization with the per-request MCP SDK. */
export function createModernRecoupHandler(
  register: (server: LegacyServer) => void,
  version: string,
  withSkills = true,
) {
  return createMcpHandler(
    async ({ authInfo, requestInfo }) => {
      const auth = authInfo as McpAuthInfo | undefined;
      const server = new McpServer(createRecoupServerInfo(version));

      // This route's tool registrars only use registerTool and registerResource.
      // Their tool callbacks consume the authenticated principal and abort signal.
      const registration = {
        registerResource: server.registerResource.bind(server),
        registerTool(
          name: string,
          config: {
            inputSchema: z.ZodType | z.ZodRawShape;
          },
          handler: LegacyTool,
        ) {
          const schema =
            config.inputSchema instanceof z.ZodType
              ? config.inputSchema
              : z.object(config.inputSchema);
          // The existing Zod version predates the JSON Schema portion of Standard Schema.
          const inputSchema = {
            "~standard": {
              ...schema["~standard"],
              jsonSchema: {
                input: () => z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }),
                output: () => z.toJSONSchema(schema, { io: "output", unrepresentable: "any" }),
              },
            },
          };
          return server.registerTool(name, { ...config, inputSchema }, async (args, ctx) => ({
            resultType: "complete" as const,
            ...(await handler(args, { authInfo: auth, signal: ctx.mcpReq.signal })),
          }));
        },
      };
      register(registration as unknown as LegacyServer);

      if (withSkills) {
        const method = requestInfo?.headers.get("Mcp-Method");
        const skillRequest =
          method === "skills/list" ||
          method === "skills/get" ||
          method === "resources/directory/read" ||
          (method === "resources/read" &&
            requestInfo?.headers.get("Mcp-Name") !== "ui://recoup/explore.html");
        const staff = skillRequest && (await hasRecoupStaffSkills(auth));
        (await getRecoupSkills(staff ? "all" : "public")).attach(server);
      }
      return server;
    },
    { legacy: "reject" },
  );
}
