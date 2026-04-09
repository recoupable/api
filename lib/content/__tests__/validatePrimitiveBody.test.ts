import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validatePrimitiveBody } from "../validatePrimitiveBody";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("@/lib/networking/safeParseJson", () => ({
  safeParseJson: vi.fn(),
}));

const { safeParseJson } = await import("@/lib/networking/safeParseJson");

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

    const request = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    const result = await validatePrimitiveBody(request, testSchema);

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(result).toEqual({ name: "test" });
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
});
