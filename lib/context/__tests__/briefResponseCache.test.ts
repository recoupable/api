import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { contextOperationHandler } from "../contextOperationHandler";
import { authorizeContextOwner } from "../authorizeContextOwner";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { callContextRpc } from "@/lib/supabase/context_requests/callContextRpc";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("@/lib/supabase/context_requests/callContextRpc", () => ({ callContextRpc: vi.fn() }));
vi.mock("../authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));
vi.mock("../dispatchContextRequest", () => ({ dispatchContextRequest: vi.fn() }));
vi.mock("../dispatchContextReleaseVerification", () => ({
  dispatchContextReleaseVerification: vi.fn(),
}));
vi.mock("../dispatchContextReleaseTrackIsrcs", () => ({
  dispatchContextReleaseTrackIsrcs: vi.fn(),
}));

const actor = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const snapshot = { id, state: "saved", brief: { text: "private retained snapshot" } };
const inputs = [
  { action: "read_brief", brief_id: id, organization_id: owner },
  {
    action: "save_brief",
    request_id: id,
    organization_id: owner,
    purpose: "company_onboarding",
    idempotency_key: "cache-test",
  },
];
const http = (body: unknown) =>
  contextOperationHandler(
    new NextRequest("http://localhost/api/context", { method: "POST", body: JSON.stringify(body) }),
  );
const expectCors = (response: NextResponse) => {
  for (const [key, value] of Object.entries(getCorsHeaders()))
    expect(response.headers.get(key)).toBe(value);
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: actor,
    orgId: owner,
    authToken: "synthetic",
  });
  vi.mocked(authorizeContextOwner).mockResolvedValue({
    accountId: actor,
    ownerId: owner,
    organizationId: owner,
  });
  vi.mocked(callContextRpc).mockImplementation(async name => {
    if (name === "read_context_request")
      return { id, owner_id: owner, status: "completed", output: { subjectIds: [] } };
    if (name === "read_context_documents") return [];
    if (name === "read_context_brief" || name === "save_context_brief") return snapshot;
    throw new Error("Unexpected RPC");
  });
});
afterEach(() => vi.restoreAllMocks());

it.each(inputs)("marks $action success private without changing its result", async input => {
  const response = await http(input);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ snapshot });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expectCors(response);
  expect(validateAuthContext).toHaveBeenCalledWith(expect.any(NextRequest), {
    organizationId: owner,
  });
  expect(callContextRpc).toHaveBeenCalledWith(
    input.action === "read_brief" ? "read_context_brief" : "save_context_brief",
    expect.objectContaining({ p_owner: owner }),
  );
});

it.each(inputs)("marks $action domain failures private with the existing error", async input => {
  vi.mocked(authorizeContextOwner).mockRejectedValue(new Error("private membership detail"));
  const response = await http(input);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error:
      "Context operation could not complete. Check scope, request ID and provider availability; retry ingestion with the same idempotency key.",
  });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expectCors(response);
  expect(callContextRpc).not.toHaveBeenCalled();
});

it.each(inputs.flatMap(input => [401, 403].map(status => ({ input, status }))))(
  "marks $input.action auth $status private without rebuilding the response",
  async ({ input, status }) => {
    const denial = NextResponse.json(
      { error: "Existing auth denial" },
      {
        status,
        headers: { ...getCorsHeaders(), "WWW-Authenticate": "Bearer", "X-Auth-Test": "retained" },
      },
    );
    vi.mocked(validateAuthContext).mockResolvedValue(denial);
    const response = await http(input);
    expect(response).toBe(denial);
    expect(response.status).toBe(status);
    expect(await response.text()).toBe('{"error":"Existing auth denial"}');
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(response.headers.get("X-Auth-Test")).toBe("retained");
    expectCors(response);
    expect(authorizeContextOwner).not.toHaveBeenCalled();
    expect(callContextRpc).not.toHaveBeenCalled();
  },
);

it.each(["brief", "read"])(
  "preserves %s cache handling on success and auth failure",
  async action => {
    const input = {
      action,
      request_id: id,
      organization_id: owner,
      ...(action === "brief" ? { purpose: "company_onboarding" } : {}),
    };
    const response = await http(input);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      action === "read" ? "private, no-store" : null,
    );
    expectCors(response);
    const denial = NextResponse.json({ error: "denied" }, { status: 403 });
    vi.mocked(validateAuthContext).mockResolvedValue(denial);
    expect(await http(input)).toBe(denial);
    expect(denial.headers.get("Cache-Control")).toBeNull();
  },
);

it.each(inputs)("marks $action storage failures private without exposing details", async input => {
  vi.mocked(callContextRpc).mockRejectedValue(new Error("private storage detail"));
  const response = await http(input);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error:
      "Context operation could not complete. Check scope, request ID and provider availability; retry ingestion with the same idempotency key.",
  });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expectCors(response);
});

it.each(inputs)("preserves validation failures for malformed $action", async input => {
  const response = await http({ ...input, account_id: actor });
  expect(response.status).toBe(400);
  expect(response.headers.get("Cache-Control")).toBeNull();
  expectCors(response);
  expect(validateAuthContext).not.toHaveBeenCalled();
  expect(callContextRpc).not.toHaveBeenCalled();
});
