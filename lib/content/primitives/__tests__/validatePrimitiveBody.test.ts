import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AuthContext } from "@/lib/auth/validateAuthContext";
import { validatePrimitiveBody } from "../validatePrimitiveBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

vi.mock("@/lib/auth/validateAuthContext", () => ({
  validateAuthContext: vi.fn(),
}));

const { safeParseJson } = await import("@/lib/networking/safeParseJson");
const { validateAuthContext } = await import("@/lib/auth/validateAuthContext");

const testSchema = z.object({
  name: z.string().min(1),
  value: z.number().optional(),
});

describe("validatePrimitiveBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns validated data on success", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({ name: "test" });
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "acc_123",
      orgId: null,
      authToken: "tok",
    } satisfies AuthContext);

    const request = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    const result = await validatePrimitiveBody(request, testSchema);

    expect(result).not.toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) {
      expect(result.accountId).toBe("acc_123");
      expect(result.data).toEqual({ name: "test" });
    }
  });

  it("returns 400 when schema validation fails", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({ name: "" });

    const request = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    const result = await validatePrimitiveBody(request, testSchema);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns auth error when auth fails", async () => {
    vi.mocked(safeParseJson).mockResolvedValue({ name: "test" });
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const request = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    const result = await validatePrimitiveBody(request, testSchema);

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });
});
