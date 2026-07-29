import "./routeTestMocks";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateCardOnFileSessionRequest } from "@/lib/stripe/validateCreateCardOnFileSessionRequest";
import { createCardOnFileSession } from "@/lib/stripe/createCardOnFileSession";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

const { POST } = await import("../route");

const ACCOUNT = "123e4567-e89b-12d3-a456-426614174001";
const SUCCESS_URL = "https://recoupable.dev/card-saved";

async function loadRealValidate() {
  const mod = await vi.importActual<
    typeof import("@/lib/stripe/validateCreateCardOnFileSessionRequest")
  >("@/lib/stripe/validateCreateCardOnFileSessionRequest");
  return mod.validateCreateCardOnFileSessionRequest;
}

function postRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/subscriptions/card-on-file", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("POST /api/subscriptions/card-on-file (validation)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(validateCreateCardOnFileSessionRequest).mockReset();
    vi.mocked(validateCreateCardOnFileSessionRequest).mockImplementation(await loadRealValidate());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it("returns 400 when body is invalid JSON", async () => {
    const res = await POST(postRequest("not-json"));
    expect(res.status).toBe(400);
    // safeParseJson turns an unparseable body into `{}`, so this lands on the
    // same missing-field message as an empty body rather than a JSON-specific one.
    await expect(res.json()).resolves.toEqual({
      error: "Invalid input: expected string, received undefined",
    });
    expect(createCardOnFileSession).not.toHaveBeenCalled();
  });

  it("returns 400 when successUrl is missing", async () => {
    const res = await POST(postRequest(JSON.stringify({})));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringMatching(/successUrl|Invalid input/i),
    });
    expect(createCardOnFileSession).not.toHaveBeenCalled();
  });

  it("returns 400 when successUrl is not a URL", async () => {
    const res = await POST(postRequest(JSON.stringify({ successUrl: "not-a-url" })));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringMatching(/successUrl/i),
    });
    expect(createCardOnFileSession).not.toHaveBeenCalled();
  });

  it("returns 400 and never trusts an accountId supplied by the caller", async () => {
    const res = await POST(
      postRequest(JSON.stringify({ successUrl: SUCCESS_URL, accountId: ACCOUNT })),
    );
    expect(res.status).toBe(400);
    expect(createCardOnFileSession).not.toHaveBeenCalled();
  });

  it("returns 401 when no credentials are provided", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );
    const res = await POST(postRequest(JSON.stringify({ successUrl: SUCCESS_URL })));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
    expect(createCardOnFileSession).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token is invalid", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce(
      NextResponse.json({ status: "error", error: "Invalid access token" }, { status: 401 }),
    );
    const res = await POST(
      postRequest(JSON.stringify({ successUrl: SUCCESS_URL }), {
        authorization: "Bearer not-a-real-privy-token",
      }),
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Invalid access token" });
    expect(createCardOnFileSession).not.toHaveBeenCalled();
  });

  it("resolves the account from the credentials on the happy path", async () => {
    vi.mocked(validateAuthContext).mockResolvedValueOnce({ accountId: ACCOUNT } as Awaited<
      ReturnType<typeof validateAuthContext>
    >);
    vi.mocked(createCardOnFileSession).mockResolvedValue({
      id: "cs_test_setup",
      url: "https://checkout.stripe.com/pay/cs_test_setup",
    } as Awaited<ReturnType<typeof createCardOnFileSession>>);

    const res = await POST(
      postRequest(JSON.stringify({ successUrl: SUCCESS_URL }), { "x-api-key": "k" }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "cs_test_setup",
      url: "https://checkout.stripe.com/pay/cs_test_setup",
    });
    expect(createCardOnFileSession).toHaveBeenCalledWith(ACCOUNT, SUCCESS_URL);
  });
});
