import { describe, expect, it } from "vitest";
import { requireUuidParam } from "@/lib/projects/requireUuidParam";

describe("requireUuidParam", () => {
  it("passes a UUID through as null", () => {
    expect(requireUuidParam("60a9a3e7-b7b2-466f-91d3-59b96e875bf6", "projectId")).toBeNull();
  });

  it("names the offending parameter in the 400", async () => {
    const response = requireUuidParam("nope", "taskId");

    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual({
      status: "error",
      error: "taskId must be a valid UUID",
    });
  });
});
