import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { registerAllTools } from "../tools";
import { resolveAccountId } from "../resolveAccountId";
import type { McpAuthInfo } from "../verifyApiKey";
import type { OAuthAccess } from "../../oauth/resolveOAuthAccess";
import { selectedContextActions } from "../../oauth/selectedContextActions";
import { selectedContextSchema } from "../../oauth/selectedContextSchema";
import { createSelectedContextAuthorizer } from "./createSelectedContextAuthorizer";
import { contextToolOperations } from "./contextToolOperations";
import { fullOAuthToolPolicy } from "./fullOAuthToolPolicy";
import { isStandardOnlyContextTool } from "./isStandardOnlyContextTool";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;
type Args = Record<string, unknown>;
export interface FullOAuthToolServices {
  prepare: (name: string, args: Args, accountId: string) => Promise<Args>;
  execute?: (
    name: string,
    args: Args,
    accountId: string,
    run: () => Promise<CallToolResult>,
  ) => Promise<CallToolResult>;
  listArtists: (accountId: string) => Promise<unknown>;
}

/** Reuse business tools while keeping full consent, identity and resource checks at execution. */
export function registerFullOAuthTools(
  server: McpServer,
  verify: (token: string) => Promise<OAuthAccess | undefined>,
  services: FullOAuthToolServices,
  mode?: "selected_context",
) {
  const register = (
    name: string,
    config: {
      description?: string;
      inputSchema: z.ZodType | z.ZodRawShape;
      annotations?: Record<string, unknown>;
    },
    handler: (args: Args, extra: Extra) => Promise<CallToolResult>,
    operation?: {
      name: string;
      action: string;
      readOnly: boolean;
      destructive: boolean;
      openWorld: boolean;
    },
  ) => {
    if (
      mode === "selected_context" &&
      (name !== "context" || (operation && !selectedContextActions.has(operation.action)))
    )
      return;
    // Credentials never belong in model-visible output. Professional roster tools
    // remain excluded until their delegated organization-grant audit is complete.
    if (
      [
        "get_api_key",
        // Private ingestion and external delivery have no delegated grant contract.
        "ingestion",
        // These legacy aliases read saved socials, not deep research. OAuth
        // clients use the existing, accurately named get_artist_socials tool.
        "spotify_deep_research",
        "artist_deep_research",
        // Registration preflight awaits the application/OAuth contract review.
        "validate_application_registration",
        "list_professional_roster",
        "confirm_professional_roster",
        "get_catalog_playcount_history",
        "get_catalog_streams",
        "manage_catalog_stream_tracking",
      ].includes(name)
    )
      return;
    if (isStandardOnlyContextTool(name)) return;
    if (name === "context" && !operation) {
      if (!(config.inputSchema instanceof z.ZodDiscriminatedUnion))
        throw new Error("Context operations must have individually discoverable schemas");
      for (const option of config.inputSchema.options) {
        if (!(option instanceof z.ZodObject)) throw new Error("Invalid context operation schema");
        const action = option.shape.action.value as keyof typeof contextToolOperations;
        const metadata = contextToolOperations[action];
        if (!metadata) throw new Error(`Missing delegated context policy for ${action}`);
        // Evidence receipts may include organization professionals; keep them
        // private to standard Context until delegated organization grants are audited.
        if ("delegated" in metadata && metadata.delegated === false) continue;
        register(
          name,
          { ...config, description: metadata.description, inputSchema: option },
          handler,
          { ...metadata, action },
        );
      }
      return;
    }
    const policy = operation
      ? {
          readOnly: operation.readOnly,
          destructive: operation.destructive,
          openWorld: operation.openWorld,
          notice: "",
        }
      : fullOAuthToolPolicy[name];
    if (!policy) throw new Error(`Missing delegated policy for ${name}`);
    // The MCP SDK accepts raw Zod shapes. The OAuth adapter also parses them itself.
    const registeredSchema =
      config.inputSchema instanceof z.ZodType ? config.inputSchema : z.object(config.inputSchema);
    const originalObject = registeredSchema instanceof z.ZodObject ? registeredSchema : undefined;
    // External agents need not create a Recoup chat merely to send an email.
    const sourceSchema =
      name === "send_email" && originalObject
        ? originalObject.extend({ room_id: originalObject.shape.room_id.optional() })
        : registeredSchema;
    const object = sourceSchema instanceof z.ZodObject ? sourceSchema : undefined;
    const hasOwner = !!object && "account_id" in object.shape;
    const inputSchema = object
      ? z
          .object(
            Object.fromEntries(
              Object.entries(object.shape)
                .filter(
                  ([key]) =>
                    key !== "account_id" &&
                    !(operation && key === "action") &&
                    !(name === "create_new_artist" && key === "active_conversation_id"),
                )
                .map(([key, schema]) => [
                  key,
                  name === "create_new_artist" && key === "organization_id"
                    ? (schema as z.ZodType).describe(
                        "Optional organization workspace ID. Use only a workspace the account can access.",
                      )
                    : schema,
                ]),
            ) as z.ZodRawShape,
          )
          .strict()
      : sourceSchema;
    const publicName =
      operation?.name ??
      (
        { get_pulses: "get_daily_email_status", update_pulse: "set_daily_email_status" } as Record<
          string,
          string
        >
      )[name] ??
      name;
    const description =
      name === "create_new_artist"
        ? "Create an artist workspace using the supplied artist name and optional organization workspace."
        : name === "get_pulses"
          ? "Read whether Recoup daily Pulse email updates are enabled for the connected account."
          : name === "update_pulse"
            ? "Enable or disable Recoup daily Pulse email updates for the connected account."
            : (config.description ?? publicName);
    server.registerTool(
      publicName,
      {
        ...config,
        description: `${description}\n${policy.notice ?? ""} Requires the full Recoup tools permission. Account identity comes from the connection.`,
        inputSchema,
        annotations: {
          ...config.annotations,
          readOnlyHint: policy.readOnly,
          destructiveHint: policy.destructive,
          openWorldHint: policy.openWorld,
        },
      },
      async (raw, extra) => {
        try {
          const auth = extra.authInfo as McpAuthInfo | undefined;
          if (!auth?.extra?.oauth) throw new Error();
          const current = await verify(auth.token);
          if (
            !current ||
            !current.scopes.includes("mcp:tools") ||
            current.accountId !== auth.extra.accountId ||
            current.grantId !== auth.extra.oauth.grantId ||
            current.clientId !== auth.clientId
          )
            throw new Error();
          const selected = current.selectedContext;
          if ((mode === "selected_context") !== !!selected) throw new Error();
          if (
            selected &&
            (!operation || name !== "context" || !selectedContextActions.has(operation.action))
          )
            throw new Error();
          // Parse again so direct handler invocations cannot smuggle owner overrides.
          const parsed = inputSchema.parse(raw) as Args;
          if (selected) {
            const approved = selectedContextSchema.parse(selected);
            if (
              JSON.stringify(approved) !==
              JSON.stringify(selectedContextSchema.parse(auth.extra.oauth.selectedContext))
            )
              throw new Error();
            if (
              parsed.organization_id !== undefined &&
              (typeof parsed.organization_id !== "string" ||
                parsed.organization_id.toLowerCase() !== approved.organizationId)
            )
              throw new Error();
            if (approved.organizationId) parsed.organization_id = approved.organizationId;
          }
          const validated = sourceSchema.parse({
            ...parsed,
            ...(operation ? { action: operation.action } : {}),
            ...(hasOwner ? { account_id: current.accountId } : {}),
          }) as Args;
          const args = await services.prepare(name, validated, current.accountId);
          const selectedContextAuthorize = selected
            ? createSelectedContextAuthorizer(current, auth.token, verify)
            : undefined;
          if (selectedContextAuthorize)
            await selectedContextAuthorize(
              current.accountId,
              selected!.organizationId ?? undefined,
            );
          const executionExtra = selectedContextAuthorize
            ? {
                ...extra,
                authInfo: {
                  ...auth,
                  extra: { ...auth.extra, oauth: current, selectedContextAuthorize },
                },
              }
            : extra;
          const run = () => handler(args, executionExtra);
          return await (services.execute
            ? services.execute(name, args, current.accountId, run)
            : run());
        } catch (error) {
          const validation = error instanceof z.ZodError;
          const throttled =
            error instanceof Error &&
            /^Tool rate limit reached; retry in \d+ seconds$/.test(error.message);
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: validation
                  ? "Invalid tool arguments. Check the tool schema and try again."
                  : throttled
                    ? (error as Error).message
                    : "Operation unavailable or permission denied. Check workspace access and reconnect with the full Recoup tools permission if needed.",
              },
            ],
          };
        }
      },
    );
  };
  // Registration functions use only registerTool. The adapter preserves their schemas and handlers.
  registerAllTools({ registerTool: register } as unknown as McpServer);
  register(
    "list_artists",
    {
      description: "List artists across the personal and organization workspaces you can access.",
      inputSchema: z.object({}).strict(),
    },
    async (_args, extra) => {
      const { accountId, error } = await resolveAccountId({
        authInfo: extra.authInfo as McpAuthInfo | undefined,
        accountIdOverride: undefined,
      });
      if (error || !accountId) throw new Error("Authentication required");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ artists: await services.listArtists(accountId) }),
          },
        ],
      };
    },
  );
}
