import { PassThrough } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAgentRegistrationHandler } from "../createAgentRegistrationHandler";
import { AgentRegistrationError } from "../AgentRegistrationError";
import type { AgentRegistrationHandlerOptions } from "../AgentRegistrationHttp";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const privateFailure = Object.assign(new Error("backend-private-canary"), {
  cause: new Error("cause-private-canary"),
  account_id: "account-private-canary",
  client_id: "client-private-canary",
  grant_id: "grant-private-canary",
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function setup() {
  const create = vi.fn().mockRejectedValue(privateFailure);
  const resolveIdentity = vi.fn().mockRejectedValue(privateFailure);
  const poll = vi.fn().mockRejectedValue(privateFailure);
  const handler = createAgentRegistrationHandler({
    config: { consentOrigin: "https://consent.example" },
    service: { create, poll },
    resolveIdentity,
  } as unknown as AgentRegistrationHandlerOptions);
  const request = async (
    path = "/agent/identity?private-query-canary",
    body = JSON.stringify({ type: "service_auth", login_hint: "payload-private-canary" }),
    headers: Record<string, string> = {},
  ) => {
    const stream = new PassThrough();
    const req = Object.assign(stream, {
      method: "POST",
      url: path,
      headers: {
        "content-type": "application/json",
        "x-request-id": "caller-request-private-canary",
        "x-correlation-id": "caller-correlation-private-canary",
        traceparent: "caller-trace-private-canary",
        ...headers,
      },
    }) as unknown as IncomingMessage;
    const res = { removeHeader: vi.fn(), setHeader: vi.fn(), writeHead: vi.fn(), end: vi.fn() };
    stream.end(body);
    const handled = await handler(req, res as unknown as ServerResponse);
    return { res, handled };
  };
  return { request, create, resolveIdentity, poll };
}

function expectFailure(
  res: Awaited<ReturnType<ReturnType<typeof setup>["request"]>>["res"],
  stage: string,
) {
  const id = res.setHeader.mock.calls.find(([name]) => name === "X-Request-ID")?.[1];
  expect(id).toMatch(uuid);
  expect(res.writeHead).toHaveBeenCalledExactlyOnceWith(503, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  expect(res.end).toHaveBeenCalledExactlyOnceWith('{"error":"temporarily_unavailable"}');
  expect(console.error).toHaveBeenCalledWith("Agent registration unavailable", {
    event: "agent_registration_unavailable",
    stage,
    request_id: id,
  });
  return id;
}

it("links each concurrent failure response only to its own server-generated diagnostic ID", async () => {
  const f = setup();
  const responses = await Promise.all([f.request(), f.request()]);
  const ids = responses.map(({ res }) => expectFailure(res, "identity"));
  expect(new Set(ids).size).toBe(2);
  expect(vi.mocked(console.error).mock.calls).toEqual(
    expect.arrayContaining(
      ids.map(request_id => [
        "Agent registration unavailable",
        {
          event: "agent_registration_unavailable",
          stage: "identity",
          request_id,
        },
      ]),
    ),
  );
  expect(console.error).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-canary");
});

it("does not include a bearer or identity backend exception in the correlated failure", async () => {
  const f = setup();
  const { res } = await f.request(
    "/agent/identity/claim",
    JSON.stringify({ claim_attempt_token: "claim-private-canary" }),
    {
      origin: "https://consent.example",
      authorization: "Bearer bearer-private-canary",
    },
  );
  expect(f.resolveIdentity).toHaveBeenCalledWith("bearer-private-canary");
  expectFailure(res, "identity");
  expect(console.error).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-canary");
});

it("labels the form handler with a fixed stage without logging its token", async () => {
  const { res } = await setup().request(
    "/token",
    new URLSearchParams({
      grant_type: "urn:workos:agent-auth:grant-type:claim",
      claim_token: "token-private-canary",
    }).toString(),
    { "content-type": "application/x-www-form-urlencoded" },
  );
  expectFailure(res, "token");
  expect(console.error).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-canary");
});

it("keeps expected service and validation failures quiet without correlation headers", async () => {
  const f = setup();
  f.create.mockRejectedValue(new AgentRegistrationError("invalid_request", 400));
  for (const body of [
    JSON.stringify({ type: "service_auth", login_hint: "synthetic" }),
    '{"type":"invalid"}',
  ]) {
    const { res } = await f.request("/agent/identity", body);
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith('{"error":"invalid_request"}');
    expect(res.setHeader).not.toHaveBeenCalled();
  }
  expect(console.error).not.toHaveBeenCalled();
});

it("keeps expected authentication failures quiet", async () => {
  const f = setup();
  f.resolveIdentity.mockRejectedValue(new AgentRegistrationError("login_required", 401));
  const { res } = await f.request("/agent/identity/claim", "{}", {
    origin: "https://consent.example",
    authorization: "Bearer synthetic",
  });
  expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
  expect(res.end).toHaveBeenCalledWith('{"error":"login_required"}');
  expect(res.setHeader.mock.calls.some(([name]) => name === "X-Request-ID")).toBe(false);
  expect(console.error).not.toHaveBeenCalled();
});

it("keeps successful and unrelated requests quiet", async () => {
  const f = setup();
  f.create.mockResolvedValue({ synthetic: true });
  const { res } = await f.request();
  expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  expect(res.setHeader).not.toHaveBeenCalled();
  const unrelated = await f.request("/unrelated");
  expect(unrelated.handled).toBe(false);
  expect(unrelated.res.writeHead).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
});
