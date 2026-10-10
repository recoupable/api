import { NextRequest, NextResponse } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { processPlayerOperation } from "../processPlayerOperation";
import { playerOperationHandler } from "../playerOperationHandler";
import { publicPlayerResponse } from "../publicPlayerResponse";
import { SiteError } from "@/lib/sites/SiteError";
import { POST as eventPost } from "@/app/api/players/events/route";
vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("../processPlayerOperation", () => ({ processPlayerOperation: vi.fn() }));
vi.mock("../recordListeningEvent", () => ({ recordListeningEvent: vi.fn() }));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("requires workspace authentication before any private operation", async () => {
  vi.mocked(validateAuthContext).mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
  const result = await playerOperationHandler(
    new NextRequest("https://api.example/api/players"),
    "list",
    {},
  );
  expect(result.status).toBe(401);
  expect(processPlayerOperation).not.toHaveBeenCalled();
});
it("passes the verified account, returns 201 and forbids private caching", async () => {
  vi.mocked(validateAuthContext).mockResolvedValue({ accountId: "verified-account" } as never);
  vi.mocked(processPlayerOperation).mockResolvedValue({ player: {} } as never);
  const result = await playerOperationHandler(
    new NextRequest("https://api.example/api/players"),
    "create",
    { name: "Release" },
  );
  expect(processPlayerOperation).toHaveBeenCalledWith("verified-account", "create", {
    name: "Release",
  });
  expect(result.status).toBe(201);
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
});
it("rejects foreign browser writes without running the operation", async () => {
  const operation = vi.fn();
  const result = await publicPlayerResponse(
    new Request("https://api.example", { headers: { origin: "https://artist.example" } }),
    operation,
    true,
  );
  expect(result.status).toBe(403);
  expect(operation).not.toHaveBeenCalled();
});
it.each([
  new SiteError(409, "Player changed"),
  z.object({ id: z.string() }).safeParse({}).error!,
  new Error("private database failure"),
])("maps errors without leaking internals", async error => {
  const result = await publicPlayerResponse(new Request("https://api.example"), async () => {
    throw error;
  });
  expect(result.status).toBe(
    error instanceof SiteError ? 409 : error instanceof z.ZodError ? 400 : 503,
  );
  expect(JSON.stringify(await result.json())).not.toContain("database failure");
  expect(result.headers.get("Cache-Control")).toBe("no-store");
});
it("reports malformed event JSON as invalid input", async () => {
  const result = await eventPost(
    new Request("https://api.example/api/players/events", {
      method: "POST",
      headers: { origin: "https://app.recoupable.dev" },
      body: "{",
    }),
  );
  expect(result.status).toBe(400);
});
