import Ajv from "ajv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { getRun } from "workflow/api";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { validateChatRunRequest } from "@/lib/chat/runs/validateChatRunRequest";
import { handleChatRunStatus } from "@/lib/chat/runs/handleChatRunStatus";
import { convertMessagesStep } from "@/app/lib/workflows/convertMessagesStep";
import fixture from "../fixtures/published-docs.json";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("workflow/api", () => ({ getRun: vi.fn() }));
vi.mock("@/lib/networking/getCorsHeaders", () => ({ getCorsHeaders: () => ({}) }));
const contract = fixture.headlessChat;
const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true });
const request = (body: unknown) =>
  new NextRequest("https://fixture.invalid/api/chat/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateAuthContext).mockResolvedValue({
    accountId: "synthetic-account",
    orgId: null,
    authToken: "dummy",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("External fetch forbidden in headless contract tests");
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("published headless chat contract against released pure boundaries", () => {
  it("includes text and inline-file request examples", () => {
    expect(contract.requestExamples.length).toBeGreaterThanOrEqual(2);
    expect(
      contract.requestExamples.some(example =>
        JSON.stringify(example).includes("data:text/plain;base64,"),
      ),
    ).toBe(true);
  });
  it.each(contract.requestExamples)(
    "validates and converts published messages without provisioning or external fetch: %j",
    async example => {
      expect(ajv.validate(contract.requestSchema, example), JSON.stringify(ajv.errors)).toBe(true);
      const result = await validateChatRunRequest(request(example));
      expect(result).not.toBeInstanceOf(NextResponse);
      if (result instanceof NextResponse) throw new Error(await result.text());
      expect(result.messages).toEqual(example.messages);
      const converted = await convertMessagesStep(result.messages);
      expect(converted).toHaveLength(example.messages.length);
      expect(JSON.stringify(converted)).toContain("Summarize");
      if (JSON.stringify(example).includes("data:text/plain"))
        expect(JSON.stringify(converted)).toContain('"type":"file"');
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it.each([
    {},
    { messages: [{ id: "invalid", role: "user", parts: [{ type: "text", text: 42 }] }] },
  ])("accepts actual 400 error envelopes with optional missing_fields: %j", async payload => {
    const result = await validateChatRunRequest(request(payload));
    expect(result).toBeInstanceOf(NextResponse);
    if (!(result instanceof NextResponse)) throw new Error("expected validation error");
    expect(result.status).toBe(400);
    const body = await result.json();
    expect(ajv.validate(contract.errorSchema, body), JSON.stringify(ajv.errors)).toBe(true);
    expect(body).toHaveProperty("error");
    expect(body).not.toHaveProperty("message");
    expect(validateAuthContext).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires an error rather than accepting the old message-only envelope", () => {
    expect(ajv.validate(contract.errorSchema, { status: "error", message: "old schema" })).toBe(
      false,
    );
    expect(ajv.validate(contract.errorSchema, { status: "error", error: "Invalid request" })).toBe(
      true,
    );
  });
  it.each(["createdAt", "startedAt", "completedAt", "durationMs"] as const)(
    "allows unavailable %s through standard JSON Schema null types",
    field => {
      const schema: Record<string, unknown> = { ...contract.statusSchema.properties[field] };
      expect(schema).not.toHaveProperty("nullable");
      delete schema.nullable;
      expect(schema.type).toEqual(expect.arrayContaining(["null"]));
      const validate = ajv.compile(schema);
      expect(validate(null)).toBe(true);
      expect(validate(false)).toBe(false);
    },
  );
  it.each(["queued", "running", "completed", "failed", "cancelled"])(
    "accepts actual %s snapshots when timing getters are unavailable",
    async status => {
      vi.mocked(getRun).mockImplementation(
        () =>
          ({
            status: Promise.resolve(status),
            get createdAt() {
              return Promise.reject(new Error("unavailable"));
            },
            get startedAt() {
              return Promise.reject(new Error("unavailable"));
            },
            get completedAt() {
              return Promise.reject(new Error("unavailable"));
            },
          }) as unknown as ReturnType<typeof getRun>,
      );
      const response = await handleChatRunStatus(
        new NextRequest("https://fixture.invalid/api/chat/runs/synthetic"),
        "synthetic",
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        createdAt: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
      });
      expect(ajv.validate(contract.statusSchema, body), JSON.stringify(ajv.errors)).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});
