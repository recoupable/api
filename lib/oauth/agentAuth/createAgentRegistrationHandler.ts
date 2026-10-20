import type { IncomingMessage, ServerResponse } from "node:http";
import { ZodError } from "zod";
import type { AgentRegistrationHandlerOptions } from "./AgentRegistrationHttp";
import { AgentRegistrationError } from "./AgentRegistrationError";
import { getAgentAuthMarkdown } from "./getAgentAuthMarkdown";
import { handleAgentTokenRequest } from "./handleAgentTokenRequest";
import { handleAgentIdentityRequest } from "./handleAgentIdentityRequest";

/** Route the opt-in profile without changing ordinary OAuth request processing. */
export function createAgentRegistrationHandler(options: AgentRegistrationHandlerOptions) {
  return async (
    req: IncomingMessage & { body?: string },
    res: ServerResponse,
  ): Promise<boolean> => {
    const path = req.url?.split("?")[0];
    const agentPath = path?.startsWith("/agent/") || path === "/auth.md";
    const formPath = req.method === "POST" && (path === "/token" || path === "/token/revocation");
    if (!agentPath && !formPath) return false;
    const reply = (status: number, body?: unknown) => {
      res.writeHead(status, { "Cache-Control": "no-store", "Content-Type": "application/json" });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    try {
      if (path === "/auth.md" && req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/markdown; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(getAgentAuthMarkdown(options.config));
      } else if (formPath) return await handleAgentTokenRequest(req, options.service, reply);
      else await handleAgentIdentityRequest(req, res, options, reply);
    } catch (error) {
      if (error instanceof AgentRegistrationError) reply(error.status, { error: error.error });
      else if (error instanceof ZodError) reply(400, { error: "invalid_request" });
      else {
        console.error("Agent registration unavailable", {
          event: "agent_registration_unavailable",
        });
        reply(503, { error: "temporarily_unavailable" });
      }
    }
    return true;
  };
}
