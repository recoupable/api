import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { triggerPrimitive } from "@/lib/trigger/triggerPrimitive";
import { createPrimitiveHandler } from "../handlePrimitiveTrigger";

vi.mock("@/lib/networking/getCorsHeaders", () => ({
  getCorsHeaders: vi.fn(() => ({ "Access-Control-Allow-Origin": "*" })),
}));

vi.mock("../validatePrimitiveBody", () => ({
  validatePrimitiveBody: vi.fn(),
}));

vi.mock("@/lib/trigger/triggerPrimitive", () => ({
  triggerPrimitive: vi.fn(),
}));

const { validatePrimitiveBody } = await import("../validatePrimitiveBody");
const { triggerPrimitive } = await import("@/lib/trigger/triggerPrimitive");

const testSchema = z.object({ name: z.string() });

describe("createPrimitiveHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 202 with runId on success", async () => {
    vi.mocked(validatePrimitiveBody).mockResolvedValue({
      accountId: "acc_123",
      data: { name: "test" },
    });
    vi.mocked(triggerPrimitive).mockResolvedValue({ id: "run_abc123" } as Awaited<
      ReturnType<typeof triggerPrimitive>
    >);

    const handler = createPrimitiveHandler("create-image", testSchema);
    const request = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    const response = await handler(request);

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.runId).toBe("run_abc123");
    expect(body.status).toBe("triggered");
  });

  it("passes through validation errors", async () => {
    vi.mocked(validatePrimitiveBody).mockResolvedValue(
      NextResponse.json({ error: "bad" }, { status: 400 }),
    );

    const handler = createPrimitiveHandler("create-image", testSchema);
    const request = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    const response = await handler(request);

    expect(response.status).toBe(400);
  });

  it("returns 500 when trigger fails", async () => {
    vi.mocked(validatePrimitiveBody).mockResolvedValue({
      accountId: "acc_123",
      data: { name: "test" },
    });
    vi.mocked(triggerPrimitive).mockRejectedValue(new Error("trigger down"));

    const handler = createPrimitiveHandler("create-image", testSchema);
    const request = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    const response = await handler(request);

    expect(response.status).toBe(500);
  });
});
