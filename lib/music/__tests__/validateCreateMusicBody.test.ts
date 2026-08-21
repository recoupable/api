import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateCreateMusicBody } from "../validateCreateMusicBody";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

const accountId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440001";

const makeRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/music", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const validBody = { prompt: "Genre: acoustic pop.", lyrics: "[verse]\nMorning light" };

describe("validateCreateMusicBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "t",
    } as never);
  });

  it("accepts prompt and lyrics and applies the documented defaults", async () => {
    const result = await validateCreateMusicBody(makeRequest(validBody));

    expect(result).toMatchObject({
      accountId,
      prompt: validBody.prompt,
      lyrics: validBody.lyrics,
      duration: 60,
      num_inference_steps: 30,
      guidance_scale: 1.7,
    });
  });

  it("rejects a missing lyrics field with a 400 naming the field", async () => {
    const result = await validateCreateMusicBody(makeRequest({ prompt: "only a prompt" }));

    expect(result).toBeInstanceOf(NextResponse);
    const res = result as NextResponse;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.status).toBe("error");
    expect(body.missing_fields).toEqual(["lyrics"]);
  });

  it("rejects a duration outside the documented range", async () => {
    const tooLong = await validateCreateMusicBody(makeRequest({ ...validBody, duration: 301 }));
    expect((tooLong as NextResponse).status).toBe(400);

    const tooShort = await validateCreateMusicBody(makeRequest({ ...validBody, duration: 5 }));
    expect((tooShort as NextResponse).status).toBe(400);
  });

  it("rejects model parameters outside their documented ranges", async () => {
    const steps = await validateCreateMusicBody(
      makeRequest({ ...validBody, num_inference_steps: 101 }),
    );
    expect((steps as NextResponse).status).toBe(400);

    const guidance = await validateCreateMusicBody(
      makeRequest({ ...validBody, guidance_scale: 21 }),
    );
    expect((guidance as NextResponse).status).toBe(400);
  });

  it("passes account_id through to the auth context as an override", async () => {
    await validateCreateMusicBody(makeRequest({ ...validBody, account_id: accountId }));

    expect(validateAuthContext).toHaveBeenCalledWith(expect.anything(), { accountId });
  });

  it("scopes to an organization by that organization's account id, not a second field", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: orgId,
      orgId,
      authToken: "t",
    } as never);

    const result = await validateCreateMusicBody(makeRequest({ ...validBody, account_id: orgId }));

    expect(result).toMatchObject({ accountId: orgId });
    expect(result).not.toHaveProperty("organizationId");
  });

  it("returns the auth failure untouched", async () => {
    const authErr = NextResponse.json({ status: "error" }, { status: 401 });
    vi.mocked(validateAuthContext).mockResolvedValue(authErr as never);

    const result = await validateCreateMusicBody(makeRequest(validBody));

    expect(result).toBe(authErr);
  });
});
