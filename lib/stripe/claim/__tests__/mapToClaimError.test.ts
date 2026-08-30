import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { mapToClaimError } from "../mapToClaimError";

describe("mapToClaimError", () => {
  it("lifts a `message`-shaped auth failure into the error envelope", async () => {
    const res = await mapToClaimError(
      NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 }),
    );
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ status: "error", error: "Unauthorized" });
  });

  it("keeps an `error`-shaped failure as is", async () => {
    const res = await mapToClaimError(
      NextResponse.json(
        { status: "error", error: "Exactly one of x-api-key or Authorization must be provided" },
        { status: 401 },
      ),
    );
    await expect(res.json()).resolves.toEqual({
      status: "error",
      error: "Exactly one of x-api-key or Authorization must be provided",
    });
  });
});
