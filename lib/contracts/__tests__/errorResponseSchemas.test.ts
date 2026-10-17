import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorResponseSchemas } from "@/lib/networking/errorResponseSchemas";
import fixture from "../fixtures/published-docs.json";

const generated = Object.fromEntries(
  Object.entries(errorResponseSchemas).map(([name, schema]) => [
    name,
    z.toJSONSchema(schema, { target: "openapi-3.0" }),
  ]),
);

if (process.env.RECOUP_ERROR_SCHEMA_OUTPUT)
  writeFileSync(process.env.RECOUP_ERROR_SCHEMA_OUTPUT, JSON.stringify(generated, null, 2) + "\n");

describe("API-owned error response schemas", () => {
  it("keeps the exported OpenAPI artifact generated from the producer types", () => {
    const source = readFileSync(
      new URL("../generated/error-responses.json", import.meta.url),
      "utf8",
    );
    expect(JSON.parse(source)).toEqual(generated);
    expect(createHash("sha256").update(source).digest("hex")).toBe(fixture.apiResponseSchemaSha256);
  });

  it("keeps each selected published response pinned to the producer schema", () => {
    for (const response of fixture.responseSchemas) {
      const expected =
        response.specification === "projects.json" && response.status === 401
          ? generated.AuthenticationErrorResponse
          : generated.ErrorResponse;
      expect(response.schema).toEqual(expected);
    }
  });
});
