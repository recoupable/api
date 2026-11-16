import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { contextOperationHandler } from "../contextOperationHandler";
import { processContextOperation } from "../processContextOperation";
import { ContextOperationError, contextOperationErrorCodes } from "../ContextOperationError";
import { formatContextOperationError } from "../formatContextOperationError";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { dispatchContextRequest } from "../dispatchContextRequest";
import { registerContextTool } from "@/lib/mcp/tools/context/registerContextTool";

const actor = "44444444-4444-4444-8444-444444444444";
vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(async () => ({ accountId: actor })),
}));
vi.mock("@/lib/mcp/resolveAccountId", () => ({
  resolveAccountId: vi.fn(async () => ({ accountId: actor, error: null })),
}));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("../dispatchContextRequest", () => ({ dispatchContextRequest: vi.fn() }));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: vi.fn(),
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: vi.fn(),
}));
vi.mock("../authorizeContextOwner", () => ({
  authorizeContextOwner: vi.fn(async (accountId: string) => ({
    accountId,
    ownerId: accountId,
    organizationId: null,
  })),
}));
vi.mock("../processContextOperation", async importOriginal => {
  const original = await importOriginal<typeof import("../processContextOperation")>();
  return { ...original, processContextOperation: vi.fn(original.processContextOperation) };
});

const read = { action: "read", request_id: "11111111-1111-4111-8111-111111111111" };
const ingest = {
  action: "ingest",
  url: "https://open.spotify.com/track/2ay96C6SLNv9urvXKD3ecB",
  idempotency_key: "same-key",
};

async function callHttp(input: unknown) {
  const response = await contextOperationHandler(
    new NextRequest("http://localhost/api/context", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
  return { status: response.status, body: await response.json() };
}

async function callMcpResult(input: unknown) {
  const registerTool = vi.fn();
  registerContextTool({ registerTool } as never);
  return registerTool.mock.calls[0][2](input, {});
}

async function callMcp(input: unknown) {
  return JSON.parse((await callMcpResult(input)).content[0].text);
}

const noRow = new Error("Context storage operation failed: query returned no rows");

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(callContextRpc).mockReset();
  vi.mocked(dispatchContextRequest).mockReset();
  vi.mocked(processContextOperation).mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Context transport error parity", () => {
  it.each(contextOperationErrorCodes)(
    "returns the same %s contract on HTTP and MCP",
    async code => {
      vi.mocked(processContextOperation).mockRejectedValueOnce(new ContextOperationError(code));
      const http = await callHttp(read);
      vi.mocked(processContextOperation).mockRejectedValueOnce(new ContextOperationError(code));
      const mcp = await callMcp(read);
      const expected = formatContextOperationError(new ContextOperationError(code));
      expect(http.status).toBe(expected.status);
      expect(http.body).toEqual(expected.body);
      expect(mcp).toEqual({
        success: false,
        code,
        message: expected.body.error,
        retryable: expected.body.retryable,
        guidance: expected.body.guidance,
      });
    },
  );

  it("flags the typed MCP failure as a tool execution error", async () => {
    vi.mocked(processContextOperation).mockRejectedValueOnce(new ContextOperationError("conflict"));
    const result = await callMcpResult(read);
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).code).toBe("conflict");
  });

  it("classifies an untyped permission failure identically on both transports", async () => {
    vi.mocked(processContextOperation).mockRejectedValueOnce(
      new Error("Access denied to context owner"),
    );
    const http = await callHttp(read);
    vi.mocked(processContextOperation).mockRejectedValueOnce(
      new Error("Access denied to context owner"),
    );
    const mcp = await callMcp(read);
    expect(http.status).toBe(403);
    expect(http.body.code).toBe("permission_denied");
    expect(mcp.code).toBe("permission_denied");
    expect(mcp.guidance).toBe(http.body.guidance);
  });

  it("reports an unsupported URL through the real operation without storage or dispatch", async () => {
    const youtube = { ...ingest, url: "https://www.youtube.com/watch?v=00000000000" };
    const http = await callHttp(youtube);
    expect(http.status).toBe(422);
    expect(http.body.code).toBe("unsupported_input");
    expect(http.body.retryable).toBe(false);
    const mcp = await callMcp(youtube);
    expect(mcp.code).toBe("unsupported_input");
    expect(mcp.guidance).toBe(http.body.guidance);
    expect(processContextOperation).toHaveBeenCalledTimes(2);
    expect(callContextRpc).not.toHaveBeenCalled();
    expect(dispatchContextRequest).not.toHaveBeenCalled();
  });

  it("keeps schema-level URL rejection as HTTP 400 before the shared operation", async () => {
    const album = { ...ingest, url: "https://open.spotify.com/album/0000000000000000000000" };
    const http = await callHttp(album);
    expect(http.status).toBe(400);
    expect(processContextOperation).not.toHaveBeenCalled();
  });

  it("reports a changed-input idempotency conflict as 409 conflict on both transports", async () => {
    const stored = new Error(
      "Context storage operation failed: Idempotency key already used for different input",
    );
    vi.mocked(callContextRpc).mockRejectedValueOnce(stored);
    const http = await callHttp(ingest);
    expect(http.status).toBe(409);
    expect(http.body.code).toBe("conflict");
    expect(JSON.stringify(http.body)).not.toContain("Context storage operation failed");
    vi.mocked(callContextRpc).mockRejectedValueOnce(stored);
    const mcp = await callMcp(ingest);
    expect(mcp.code).toBe("conflict");
    expect(mcp.message).toBe(http.body.error);
    expect(dispatchContextRequest).not.toHaveBeenCalled();
  });

  it("reports a missing request as 404 not_found on both transports", async () => {
    vi.mocked(callContextRpc).mockResolvedValue(null);
    const http = await callHttp(read);
    expect(http.status).toBe(404);
    expect(http.body.code).toBe("not_found");
    const mcp = await callMcp(read);
    expect(mcp.code).toBe("not_found");
  });

  it("reports a request that cannot serve a brief yet as 409 not_ready", async () => {
    vi.mocked(callContextRpc).mockResolvedValue({
      id: read.request_id,
      owner_id: actor,
      status: "queued",
    });
    const brief = { action: "brief", request_id: read.request_id, purpose: "creative_direction" };
    const http = await callHttp(brief);
    expect(http.status).toBe(409);
    expect(http.body.code).toBe("not_ready");
    expect(http.body.retryable).toBe(true);
    const mcp = await callMcp(brief);
    expect(mcp.code).toBe("not_ready");
  });

  it("does not interpret an invalid stored prerequisite shape as caller readiness", async () => {
    vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_TRACK_ISRC_ENABLED", "true");
    vi.mocked(callContextRpc).mockResolvedValue({
      state: "pending",
      linkedSlots: 0,
      hasMore: false,
    });
    const verify = {
      action: "verify_release_tracks",
      request_id: read.request_id,
      subject_id: "22222222-2222-4222-8222-222222222222",
    };
    const http = await callHttp(verify);
    expect(http.status).toBe(500);
    expect(http.body.code).toBe("internal");
    const mcp = await callMcp(verify);
    expect(mcp.code).toBe("internal");
  });

  it("reports a disabled capability as 503 unavailable on both transports", async () => {
    vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "false");
    const verify = { action: "verify_release", request_id: read.request_id };
    const http = await callHttp(verify);
    expect(http.status).toBe(503);
    expect(http.body.code).toBe("unavailable");
    expect(http.body.retryable).toBe(true);
    const mcp = await callMcp(verify);
    expect(mcp.code).toBe("unavailable");
  });

  it.each([
    ["read_brief", { action: "read_brief", brief_id: "33333333-3333-4333-8333-333333333333" }],
    [
      "read_execution",
      { action: "read_execution", execution_id: "55555555-5555-4555-8555-555555555555" },
    ],
    ["list_executions", { action: "list_executions", request_id: read.request_id }],
    ["verify_release", { action: "verify_release", request_id: read.request_id }],
  ])("keeps unproven SQL no-row failures from %s opaque and non-retryable", async (_, input) => {
    vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
    vi.mocked(callContextRpc).mockRejectedValue(noRow);
    const http = await callHttp(input);
    expect(http.status).toBe(409);
    expect(http.body).toMatchObject({ code: "storage_failed", retryable: false });
    expect(JSON.stringify(http.body)).not.toContain("query returned");
    const mcp = await callMcp(input);
    expect(mcp).toMatchObject({ code: "storage_failed", retryable: false });
  });

  it("reports a null stored planning shape as internal without guessing why", async () => {
    vi.mocked(callContextRpc).mockResolvedValue(null);
    const plan = { action: "plan", request_id: read.request_id };
    const http = await callHttp(plan);
    expect(http.status).toBe(500);
    expect(http.body).toMatchObject({ code: "internal", retryable: false });
    const mcp = await callMcp(plan);
    expect(mcp.code).toBe("internal");
  });

  it("does not infer a caller conflict from a stored release schema mismatch", async () => {
    vi.stubEnv("CONTEXT_SPOTIFY_RELEASE_VERIFY_ENABLED", "true");
    vi.mocked(callContextRpc).mockResolvedValue({
      subjectId: "22222222-2222-4222-8222-222222222222",
      kind: "release",
      identityConfirmed: true,
      availableFields: ["spotify_id"],
      reusableModules: [],
    });
    const verify = { action: "verify_release", request_id: read.request_id };
    const http = await callHttp(verify);
    expect(http.status).toBe(500);
    expect(http.body).toMatchObject({ code: "internal", retryable: false });
    const mcp = await callMcp(verify);
    expect(mcp).toMatchObject({ code: "internal", retryable: false });
  });
});

it.each([
  new Error("private-record-777 unavailable", { cause: new Error("private-token-888") }),
  new Error("Context storage operation failed: private-record-777 timeout", {
    cause: "private-token-888",
  }),
])("redacts exception messages and causes from both transports and logs", async error => {
  vi.mocked(callContextRpc).mockRejectedValue(error);
  const http = await callHttp(read);
  const mcp = await callMcp(read);
  expect(mcp.code).toBe(http.body.code);
  expect(mcp.guidance).toBe(http.body.guidance);
  expect(JSON.stringify([http, mcp, vi.mocked(console.error).mock.calls])).not.toMatch(
    /private-record-777|private-token-888/,
  );
  expect(vi.mocked(console.error).mock.calls).toEqual([
    ["[context] read failed", { reason: "dependency_or_access" }],
    ["[context] MCP operation failed", { reason: "dependency_or_access" }],
  ]);
});

it("scopes uncertain-write guidance to keyed writes on both transports", async () => {
  vi.mocked(callContextRpc).mockRejectedValue(new Error("fetch failed"));
  const http = await callHttp(ingest);
  const mcp = await callMcp(ingest);
  expect(http.status).toBe(503);
  expect(mcp.guidance).toBe(http.body.guidance);
  expect(http.body.guidance).toContain("same idempotency key and unchanged input");
  expect((await callHttp(read)).body.guidance).not.toContain("idempotency");
  expect((await callMcp(read)).guidance).not.toContain("idempotency");
});

it.each(["Case is unavailable", "Case review unavailable", "Catalog case unavailable"])(
  "does not reveal why a record is unavailable for %s",
  async message => {
    vi.mocked(callContextRpc).mockRejectedValue(
      new Error(`Context storage operation failed: ${message}`),
    );
    const http = await callHttp(read);
    const mcp = await callMcp(read);
    expect(http.status).toBe(404);
    expect(http.body.error).toBe("Context record not found in the selected workspace.");
    expect(mcp.message).toBe(http.body.error);
    expect(JSON.stringify([http, mcp])).not.toContain(message);
  },
);

it("keeps a partial ingestion result successful without redispatch on reconnect", async () => {
  const request = {
    id: read.request_id,
    owner_id: actor,
    status: "partial",
    output: { gaps: [{ topic: "lyrics", reason: "unavailable" }] },
  };
  vi.mocked(callContextRpc).mockResolvedValue(request);
  const http = await callHttp(ingest);
  const mcp = await callMcp(ingest);
  expect(http).toEqual({ status: 202, body: { request } });
  expect(mcp).toEqual({ request });
  expect(dispatchContextRequest).not.toHaveBeenCalled();
  expect(
    vi.mocked(callContextRpc).mock.calls.every(([, args]) => args.p_key === ingest.idempotency_key),
  ).toBe(true);
});
