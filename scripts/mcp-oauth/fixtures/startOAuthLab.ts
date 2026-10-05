import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { createLabProvider } from "../createLabProvider";

/** Start an isolated real-HTTP OAuth/MCP fixture. All identity and data are synthetic. */
export async function startOAuthLab() {
  const http = createServer();
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const issuer = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  const resource = `${issuer}/mcp`;
  const metadataDocuments = new Map<string, Record<string, unknown>>();
  const provider = createLabProvider(issuer, metadataDocuments);
  const providerHandler = provider.callback();
  let value = "initial";
  let consentAllowed = true;
  http.on("request", async (req, res) => {
    try {
      if (req.url === "/.well-known/oauth-protected-resource") {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            resource,
            authorization_servers: [issuer],
            scopes_supported: ["mcp:read", "mcp:write"],
          }),
        );
        return;
      }
      if (req.url === "/mcp") {
        const tokenString = req.headers.authorization?.replace(/^Bearer /, "");
        const token = tokenString ? await provider.AccessToken.find(tokenString) : undefined;
        const grant = token?.grantId ? await provider.Grant.find(token.grantId) : undefined;
        if (!token || token.isExpired || token.aud !== resource || !grant || grant.isExpired) {
          res.writeHead(401, {
            "WWW-Authenticate": `Bearer resource_metadata="${issuer}/.well-known/oauth-protected-resource"`,
          });
          res.end();
          return;
        }
        const scopes = new Set(token.scope?.split(" "));
        const server = new McpServer({ name: "recoup-oauth-synthetic-fixture", version: "0.0.0" });
        server.registerTool("read_fixture", { inputSchema: {} }, async () =>
          scopes.has("mcp:read")
            ? { content: [{ type: "text", text: value }] }
            : { isError: true, content: [{ type: "text", text: "insufficient_scope" }] },
        );
        server.registerTool("write_fixture", { inputSchema: { value: z.string() } }, async args => {
          if (!scopes.has("mcp:write"))
            return { isError: true, content: [{ type: "text", text: "insufficient_scope" }] };
          value = args.value;
          return { content: [{ type: "text", text: "updated" }] };
        });
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        res.on("close", () => {
          void transport.close();
          void server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }
      if (req.url?.startsWith("/interaction/")) {
        // Deliberately fixture-only: a synthetic account explicitly accepts the requested scopes.
        // Production must replace this with verified Privy identity + CSRF-bound consent UI.
        const details = await provider.interactionDetails(req, res);
        if (!consentAllowed) {
          await provider.interactionFinished(
            req,
            res,
            { error: "access_denied" },
            { mergeWithLastSubmission: false },
          );
          return;
        }
        const grant = new provider.Grant({
          accountId: "synthetic-account",
          clientId: String(details.params.client_id),
        });
        grant.addOIDCScope(String(details.params.scope));
        const requested = String(details.params.scope)
          .split(" ")
          .filter(s => s.startsWith("mcp:"));
        grant.addResourceScope(resource, requested.join(" "));
        const grantId = await grant.save();
        await provider.interactionFinished(
          req,
          res,
          {
            login: { accountId: "synthetic-account" },
            consent: { grantId },
          },
          { mergeWithLastSubmission: false },
        );
        return;
      }
      await providerHandler(req, res);
    } catch {
      res.statusCode = 500;
      res.end("Fixture request failed");
    }
  });
  const authorize = async (start: string) => {
    const cookies = new Map<string, string>();
    let next = new URL(start);
    for (let step = 0; step < 12; step++) {
      const response = await fetch(next, {
        redirect: "manual",
        headers: { cookie: [...cookies.values()].join("; ") },
      });
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(";")[0];
        cookies.set(pair.split("=")[0], pair);
      }
      if (response.status >= 500)
        throw new Error(`OAuth lab server failed with ${response.status}`);
      const location = response.headers.get("location");
      if (!location) return next;
      next = new URL(location, issuer);
      if (next.origin !== issuer) return next;
    }
    throw new Error("Fixture authorization exceeded redirect limit");
  };
  const exerciseMcp = async (token: string) => {
    const client = new Client({ name: "generic-compatibility-agent", version: "0.0.0" });
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(resource), {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
        }),
      );
      const tools = (await client.listTools()).tools.map(tool => tool.name);
      const before = await client.callTool({ name: "read_fixture", arguments: {} });
      const written = await client.callTool({
        name: "write_fixture",
        arguments: { value: "updated by agent" },
      });
      const after = await client.callTool({ name: "read_fixture", arguments: {} });
      const firstText = (result: typeof before) =>
        (result.content as Array<{ text?: string }>)[0]?.text;
      return {
        tools,
        before: firstText(before),
        after: firstText(after),
        writeDenied: written.isError === true,
      };
    } finally {
      await client.close();
    }
  };
  return {
    issuer,
    resource,
    provider,
    authorize,
    exerciseMcp,
    metadataDocuments,
    denyConsent: () => {
      consentAllowed = false;
    },
    revokeGrant: async (tokenString: string) => {
      const token = await provider.AccessToken.find(tokenString);
      const grant = token?.grantId ? await provider.Grant.find(token.grantId) : undefined;
      await grant?.destroy();
    },
    close: async () => {
      http.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        http.close(error => (error ? reject(error) : resolve())),
      );
    },
  };
}
