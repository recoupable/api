import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { withMcpAuth } from "mcp-handler";
import { createRecoupServerInfo } from "@/lib/mcp/createRecoupServerInfo";
import { setOAuthMcpHeaders } from "@/lib/mcp/oauth/setOAuthMcpHeaders";
import { getRecoupSkills } from "@/lib/mcp/skills/getRecoupSkills";
import { verifyBearerToken } from "@/lib/mcp/verifyApiKey";

const requiredScopes = ["mcp:tools"];

const staffHandler = createMcpHandler(
  async () => {
    const server = new McpServer({
      ...createRecoupServerInfo("0.1.0"),
      name: "recoup-staff",
      title: "Recoup Staff",
    });
    (await getRecoupSkills("staff")).attach(server);
    return server;
  },
  { legacy: "reject" },
);

export async function POST(request: Request) {
  const bearer = /^Bearer +([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  const auth = await verifyBearerToken(request, bearer);
  const response = await withMcpAuth(
    async request => {
      if (!auth || auth.extra.oauth?.selectedContext) return new Response(null, { status: 403 });
      const { isRecoupAdmin } = await import("@/lib/organizations/isRecoupAdmin");
      if (!(await isRecoupAdmin(auth.extra.accountId))) return new Response(null, { status: 403 });
      return staffHandler.fetch(request, { authInfo: auth });
    },
    async () => auth,
    {
      required: true,
      requiredScopes,
      resourceMetadataPath: "/.well-known/oauth-protected-resource/mcp",
    },
  )(request);
  return setOAuthMcpHeaders(
    response,
    process.env.OAUTH_ENABLED === "true" ? process.env.OAUTH_ISSUER : undefined,
    requiredScopes,
  );
}

export async function OPTIONS() {
  return setOAuthMcpHeaders(new Response(null, { status: 204 }));
}
