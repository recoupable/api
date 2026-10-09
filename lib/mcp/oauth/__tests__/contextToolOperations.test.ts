import { expect, it, vi } from "vitest";
import { z } from "zod";
import { contextOperationSchema } from "@/lib/context/processContextOperation";
import { contextToolOperations } from "../contextToolOperations";

vi.mock("@/lib/context/authorizeContextOwner", () => ({ authorizeContextOwner: vi.fn() }));

it("covers every real context operation with a unique public tool and concrete JSON schema", () => {
  const actions = contextOperationSchema.options.map(option => option.shape.action.value);
  expect(Object.keys(contextToolOperations).sort()).toEqual(actions.sort());
  const names = Object.values(contextToolOperations).map(operation => operation.name);
  expect(new Set(names).size).toBe(actions.length);
  for (const option of contextOperationSchema.options) {
    const schema = z.toJSONSchema((option as z.ZodObject).omit({ action: true }));
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties ?? {}).length).toBeGreaterThan(0);
    expect(schema.properties).not.toHaveProperty("action");
  }
});
