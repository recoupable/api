import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toJsonSchema } from "../toJsonSchema";

describe("toJsonSchema", () => {
  it("returns {} for undefined input", () => {
    expect(toJsonSchema(undefined)).toEqual({});
  });

  it("returns {} for null input", () => {
    expect(toJsonSchema(null)).toEqual({});
  });

  it("converts a Zod schema into a JSON Schema object", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });

    const result = toJsonSchema(schema);

    expect(result).toEqual(
      expect.objectContaining({
        type: "object",
        properties: expect.objectContaining({
          name: expect.objectContaining({ type: "string" }),
          age: expect.objectContaining({ type: "number" }),
        }),
      }),
    );
    // Should NOT include Zod internals
    expect(result).not.toHaveProperty("_def");
    expect(result).not.toHaveProperty("~standard");
  });

  it("returns plain JSON Schema objects unchanged", () => {
    const plainSchema = {
      type: "object",
      properties: { foo: { type: "string" } },
    };

    expect(toJsonSchema(plainSchema)).toEqual(plainSchema);
  });

  it("returns a JSON-Schema-shaped result without Zod internals for malformed Zod-like inputs", () => {
    // A Zod-like object that isn't actually a valid Zod schema. The converter
    // is permissive — it produces a best-effort JSON Schema document rather
    // than throwing. We just want to confirm no Zod internals leak through.
    const malformed = { _def: { unknownKeys: "strict" } };

    const result = toJsonSchema(malformed);

    expect(result).not.toHaveProperty("_def");
    expect(result).not.toHaveProperty("~standard");
    expect(result).not.toHaveProperty("typeName");
  });
});
