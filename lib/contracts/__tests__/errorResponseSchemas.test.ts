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

  it.each([
    { specification: "releases.json", path: "/api/artists/{id}/profile", status: 404 },
    { specification: "projects.json", path: "/api/projects/{projectId}", status: 401 },
    { specification: "projects.json", path: "/api/projects/{projectId}", status: 404 },
  ])("keeps the API-owned $specification $status response pinned to its producer", target => {
    const response = fixture.responseSchemas.find(
      candidate =>
        candidate.method === "GET" &&
        candidate.specification === target.specification &&
        candidate.path === target.path &&
        candidate.status === target.status,
    );
    expect(response).toBeDefined();
    const expected =
      target.status === 401 ? generated.AuthenticationErrorResponse : generated.ErrorResponse;
    expect(response!.schema).toEqual(expected);
  });
});
