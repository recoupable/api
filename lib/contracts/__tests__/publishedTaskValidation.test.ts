import Ajv from "ajv";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { validateCreateTaskRequest } from "@/lib/tasks/validateCreateTaskRequest";
import { validateUpdateTaskRequest } from "@/lib/tasks/validateUpdateTaskRequest";
import fixture from "../fixtures/published-docs.json";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));

interface TaskValidationContract {
  path: string;
  responses: Record<
    "POST" | "PATCH",
    { schema: Record<string, unknown>; examples: Record<string, unknown> }
  >;
}
const contract = (fixture as unknown as { taskValidation?: TaskValidationContract }).taskValidation;
const id = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const methods = [
  { method: "POST" as const, validate: validateCreateTaskRequest },
  { method: "PATCH" as const, validate: validateUpdateTaskRequest },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network access in task validation contract");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("published task validation errors", () => {
  for (const { method, validate } of methods) {
    it(`${method} declares text errors and an optional field path`, () => {
      expect(contract).toBeDefined();
      expect(contract!.path).toBe("/api/tasks");
      const response = contract!.responses[method];
      expect(response.schema).toMatchObject({
        type: "object",
        required: ["status", "error"],
        properties: {
          status: { type: "string", enum: ["error"] },
          error: { type: "string" },
          missing_fields: {
            type: "array",
            items: { oneOf: [{ type: "string" }, { type: "integer" }] },
          },
        },
      });
      expect(Object.keys(response.examples).sort()).toEqual(["invalidJson", "invalidScheduleType"]);
      const matches = new Ajv({ strict: false, validateFormats: false }).compile(response.schema);
      for (const body of Object.values(response.examples)) expect(matches(body)).toBe(true);
      expect(matches({ error: 400, message: "Bad request" })).toBe(false);
      expect(matches({ status: "error" })).toBe(false);
      expect(matches({ error: "Invalid JSON body" })).toBe(false);
    });

    it.each(["invalidJson", "invalidScheduleType"])(
      `${method} actual validator matches the published %s example before authentication`,
      async example => {
        expect(contract).toBeDefined();
        const body =
          example === "invalidJson"
            ? "{"
            : JSON.stringify(
                method === "POST"
                  ? {
                      title: "Weekly update",
                      prompt: "Summarize releases",
                      schedule: 42,
                      artist_account_id: id,
                    }
                  : { id, schedule: 42 },
              );
        const response = await validate(
          new NextRequest("https://example.invalid/api/tasks", { method, body }),
        );
        expect(response).toBeInstanceOf(NextResponse);
        if (!(response instanceof NextResponse)) throw new Error("Expected validation error");
        expect(response.status).toBe(400);
        const result = await response.json();
        const matches = new Ajv({ strict: false, allErrors: true, validateFormats: false }).compile(
          contract!.responses[method].schema,
        );
        expect(matches(result), JSON.stringify(matches.errors)).toBe(true);
        expect(result).toEqual(contract!.responses[method].examples[example]);
        if (example === "invalidJson") expect(result).not.toHaveProperty("missing_fields");
        else expect(result.missing_fields).toEqual(["schedule"]);
        for (const [name, value] of Object.entries(getCorsHeaders())) {
          expect(response.headers.get(name)).toBe(value);
        }
        expect(validateAuthContext).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
      },
    );
  }

  it("preserves a valid title-only PATCH and resolves authentication without adding a schedule", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "synthetic",
    });
    const request = new NextRequest("https://example.invalid/api/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id, title: "Updated title" }),
    });
    const result = await validateUpdateTaskRequest(request);
    expect(result).toEqual({ id, title: "Updated title", resolvedAccountId: accountId });
    expect(result).not.toHaveProperty("schedule");
    expect(validateAuthContext).toHaveBeenCalledExactlyOnceWith(request, { accountId: undefined });
    expect(fetch).not.toHaveBeenCalled();
  });
});
