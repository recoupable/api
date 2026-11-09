import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { processIngestionOperation } from "../processIngestionOperation";
import { ingestionOperationHandler } from "../ingestionOperationHandler";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("../createIngestionDependencies", () => ({ createIngestionDependencies: () => ({}) }));
vi.mock("../dispatchIngestionJob", () => ({ dispatchIngestionJob: vi.fn() }));
vi.mock("../processIngestionOperation", () => ({ processIngestionOperation: vi.fn() }));

describe("ingestion HTTP boundary", () => {
  it.each([
    ["Access denied", 403],
    ["Idempotency conflict", 409],
    ["Ingestion request limit reached", 429],
    ["backend unavailable", 503],
  ])("maps %s without leaking internal detail", async (message, status) => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "actor",
      orgId: null,
      authToken: "secret",
    });
    vi.mocked(processIngestionOperation).mockRejectedValue(new Error(message));
    const response = await ingestionOperationHandler(
      new NextRequest("https://test/api/ingestion", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(status);
  });
  it("supports authenticated GET retrieval while rejecting mutation query parameters", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "actor",
      orgId: null,
      authToken: "secret",
    });
    vi.mocked(processIngestionOperation).mockResolvedValue({
      job_id: "a".repeat(64),
      status: "ready",
    });
    const response = await ingestionOperationHandler(
      new NextRequest(`https://test/api/ingestion?job_id=${"a".repeat(64)}`),
    );
    expect(response.status).toBe(200);
    expect(vi.mocked(processIngestionOperation).mock.calls[0][1]).toEqual({
      action: "read",
      job_id: "a".repeat(64),
    });
    expect(
      (
        await ingestionOperationHandler(
          new NextRequest(`https://test/api/ingestion?job_id=${"a".repeat(64)}&action=deliver`),
        )
      ).status,
    ).toBe(400);
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("INGESTION_ENABLED", "true");
  });
  it("fails closed while disabled", async () => {
    vi.stubEnv("INGESTION_ENABLED", "false");
    expect(
      (
        await ingestionOperationHandler(
          new NextRequest("https://test/api/ingestion", { method: "POST" }),
        )
      ).status,
    ).toBe(404);
    expect(validateAuthContext).not.toHaveBeenCalled();
  });
  it("authenticates before reading a request body", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const response = await ingestionOperationHandler(
      new NextRequest("https://test/api/ingestion", { method: "POST", body: "not json" }),
    );
    expect(response.status).toBe(401);
    expect(processIngestionOperation).not.toHaveBeenCalled();
  });
  it("uses authenticated identity and returns private uncached results", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "actor",
      orgId: null,
      authToken: "secret",
    });
    vi.mocked(processIngestionOperation).mockResolvedValue({
      job_id: "a".repeat(64),
      status: "ready",
    });
    const response = await ingestionOperationHandler(
      new NextRequest("https://test/api/ingestion", {
        method: "POST",
        body: JSON.stringify({ action: "read", job_id: "a".repeat(64) }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(vi.mocked(processIngestionOperation).mock.calls[0][0]).toBe("actor");
  });
  it("redacts internal exceptions and credentials", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "actor",
      orgId: null,
      authToken: "secret",
    });
    vi.mocked(processIngestionOperation).mockRejectedValue(
      new Error("postgres://secret:password@db/private"),
    );
    const response = await ingestionOperationHandler(
      new NextRequest("https://test/api/ingestion", { method: "POST", body: "{}" }),
    );
    expect(await response.text()).not.toMatch(/password|postgres|private/);
  });
  it("bounds streamed bodies even without Content-Length", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId: "actor",
      orgId: null,
      authToken: "secret",
    });
    const response = await ingestionOperationHandler(
      new NextRequest("https://test/api/ingestion", {
        method: "POST",
        body: "x".repeat(3 * 1024 * 1024 + 1),
      }),
    );
    expect(response.status).toBe(413);
    expect(processIngestionOperation).not.toHaveBeenCalled();
  });
});
