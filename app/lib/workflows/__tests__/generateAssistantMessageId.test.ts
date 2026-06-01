import { describe, it, expect, vi } from "vitest";
import { generateAssistantMessageId } from "@/app/lib/workflows/generateAssistantMessageId";

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, generateId: vi.fn(() => "generated-by-mock") };
});

describe("generateAssistantMessageId", () => {
  it("returns the value from ai's generateId()", async () => {
    const id = await generateAssistantMessageId();
    expect(id).toBe("generated-by-mock");
  });

  it("returns a string", async () => {
    const id = await generateAssistantMessageId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});
