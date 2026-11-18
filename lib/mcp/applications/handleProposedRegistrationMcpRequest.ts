import { NextResponse, type NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { ProposedDependencies } from "@/lib/applications/proposedRegistration/proposedRegistrationContract";
import { setOAuthMcpHeaders } from "@/lib/mcp/oauth/setOAuthMcpHeaders";
import { verifyExistingApplicationMcpActor } from "./verifyExistingApplicationMcpActor";
import { createProposedRegistrationMcpLifetime } from "./createProposedRegistrationMcpLifetime";
import { readProposedRegistrationMcpBody } from "./readProposedRegistrationMcpBody";
import { registerCreateProposedRegistrationTool } from "./registerCreateProposedRegistrationTool";
import { registerReadProposedRegistrationTool } from "./registerReadProposedRegistrationTool";
/** Unregistered, proposed-only HTTP composition. No production dependency factory or route caller. */
export async function handleProposedRegistrationMcpRequest(
  request: NextRequest,
  dependencies: ProposedDependencies,
): Promise<Response> {
  const life = createProposedRegistrationMcpLifetime(request);
  // Own unread input too: auth/header/length rejection must not leave a streaming source alive.
  life.own(async () => {
    if (request.body && !request.body.locked && !request.bodyUsed) await request.body.cancel();
  });
  let response: Response;
  try {
    response = await life.run(async () => {
      if (request.method === "OPTIONS") return new Response(null, { status: 204 });
      const verified = await life.run(() => verifyExistingApplicationMcpActor(request));
      if (verified instanceof NextResponse) return verified;
      if (request.method !== "POST")
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      const admission = structuredClone(verified);
      Object.freeze(admission.verificationEvidence.principal);
      Object.freeze(admission.verificationEvidence);
      Object.freeze(admission);
      const body = await readProposedRegistrationMcpBody(request, life);
      life.assertActive();
      const server = new McpServer({ name: "recoup-proposed-registration", version: "0.0.0" });
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      // Register ownership before any registration/connect stage can fail or hang.
      life.own(async () => {
        try {
          if (server.server.transport) await server.close();
          else await transport.close();
        } catch {
          await transport.close();
          throw new Error("Transport cleanup unconfirmed");
        }
      });
      const context = { request, admission, dependencies, life };
      registerCreateProposedRegistrationTool(server, context);
      registerReadProposedRegistrationTool(server, context);
      await life.run(() => server.connect(transport));
      return life.run(() => transport.handleRequest(request, { parsedBody: body }));
    });
  } catch (error) {
    response =
      error instanceof Response
        ? error
        : Response.json({ error: "Registration transport unavailable" }, { status: 503 });
  }
  try {
    await life.close();
  } catch {
    response = Response.json(
      { error: "Transport cleanup unconfirmed; storage outcome may be unknown" },
      { status: 503 },
    );
  }
  return setOAuthMcpHeaders(response);
}
