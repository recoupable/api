import Ajv from "ajv";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, PATCH, DELETE } from "@/app/api/tasks/route";
import { getAccountIdByApiKey } from "@/lib/auth/getAccountIdByApiKey";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { createTask } from "@/lib/tasks/createTask";
import { updateTask } from "@/lib/tasks/updateTask";
import { deleteTask } from "@/lib/tasks/deleteTask";
import { enrichTasks } from "@/lib/tasks/enrichTasks";
import fixture from "../fixtures/published-docs.json";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/auth/getAccountIdByApiKey", () => ({ getAccountIdByApiKey: vi.fn() }));
vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/tasks/createTask", () => ({ createTask: vi.fn() }));
vi.mock("@/lib/tasks/updateTask", () => ({
  updateTask: vi.fn(),
  TASK_ACCESS_DENIED_MESSAGE: "synthetic ownership denial",
}));
vi.mock("@/lib/tasks/deleteTask", () => ({
  deleteTask: vi.fn(),
  TASK_ACCESS_DENIED_MESSAGE: "synthetic ownership denial",
}));
vi.mock("@/lib/tasks/enrichTasks", () => ({ enrichTasks: vi.fn() }));
vi.mock("@/lib/plans/getTaskRunBlock", () => ({ getTaskRunBlock: vi.fn() }));

type Method = "GET" | "POST" | "PATCH" | "DELETE";
interface AuthenticationContract {
  path: string;
  operations: Record<Method, { security: unknown[]; examples: Record<string, unknown> }>;
}
const contract = (fixture as unknown as { taskAuthentication?: AuthenticationContract })
  .taskAuthentication;
const id = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const operations = [
  { method: "GET" as const, handler: GET, body: undefined },
  {
    method: "POST" as const,
    handler: POST,
    body: {
      title: "Weekly update",
      prompt: "Summarize releases",
      schedule: "0 9 * * 1",
      artist_account_id: id,
    },
  },
  { method: "PATCH" as const, handler: PATCH, body: { id, title: "Updated title" } },
  { method: "DELETE" as const, handler: DELETE, body: { id } },
];
const denied: Array<{ name: string; headers: Record<string, string>; example: string }> = [
  { name: "missing credentials", headers: {}, example: "missingOrConflictingCredentials" },
  {
    name: "conflicting credentials",
    headers: { "x-api-key": "invalid-key", authorization: "Bearer recoup_sk_invalid" },
    example: "missingOrConflictingCredentials",
  },
  {
    name: "invalid API key",
    headers: { "x-api-key": "invalid-key" },
    example: "invalidCredential",
  },
  {
    name: "invalid Bearer API key",
    headers: { authorization: "Bearer recoup_sk_invalid" },
    example: "invalidCredential",
  },
];

function responseSchema(method: Method) {
  const response = fixture.responseSchemas.find(
    item => item.method === method && item.path === "/api/tasks" && item.status === 401,
  );
  expect(response, `Missing ${method} /api/tasks 401 contract`).toBeDefined();
  return new Ajv({ strict: false, allErrors: true, validateFormats: false }).compile(
    response!.schema,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAccountIdByApiKey).mockResolvedValue(null);
  vi.mocked(selectScheduledActions).mockResolvedValue([]);
  vi.mocked(enrichTasks).mockResolvedValue([]);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network access in task authentication contract");
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("published task authentication", () => {
  for (const { method, handler, body } of operations) {
    it(`${method} explicitly declares both credential alternatives and both text-error envelopes`, () => {
      expect(contract).toBeDefined();
      expect(contract!.path).toBe("/api/tasks");
      expect(contract!.operations[method].security).toEqual([
        { apiKeyAuth: [] },
        { bearerAuth: [] },
      ]);
      expect(Object.keys(contract!.operations[method].examples).sort()).toEqual([
        "invalidCredential",
        "missingOrConflictingCredentials",
      ]);
      const matches = responseSchema(method);
      for (const value of Object.values(contract!.operations[method].examples))
        expect(matches(value)).toBe(true);
      expect(matches({ error: 401, message: "Unauthorized" })).toBe(false);
      expect(matches({ status: "error" })).toBe(false);
      expect(matches({ message: "Unauthorized" })).toBe(false);
    });

    it.each(denied)(
      `${method} actual route preserves $name without task operations`,
      async ({ headers, example }) => {
        const response = await handler(
          new NextRequest("https://example.invalid/api/tasks", {
            method,
            headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
        );
        expect(response.status).toBe(401);
        const result = await response.json();
        const matches = responseSchema(method);
        expect(matches(result), JSON.stringify(matches.errors)).toBe(true);
        expect(contract).toBeDefined();
        expect(result).toEqual(contract!.operations[method].examples[example]);
        for (const [name, value] of Object.entries(getCorsHeaders()))
          expect(response.headers.get(name)).toBe(value);
        expect(selectScheduledActions).not.toHaveBeenCalled();
        expect(createTask).not.toHaveBeenCalled();
        expect(updateTask).not.toHaveBeenCalled();
        expect(deleteTask).not.toHaveBeenCalled();
        expect(enrichTasks).not.toHaveBeenCalled();
        expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
        expect(getAccountIdByApiKey).toHaveBeenCalledTimes(example === "invalidCredential" ? 1 : 0);
      },
    );
  }

  it.each([
    { name: "API-key", headers: { "x-api-key": "synthetic-key" }, key: "synthetic-key" },
    {
      name: "Bearer API-key",
      headers: { authorization: "Bearer recoup_sk_synthetic" },
      key: "recoup_sk_synthetic",
    },
  ])("retains a synthetic authenticated GET control via $name", async ({ headers, key }) => {
    vi.mocked(getAccountIdByApiKey).mockResolvedValue(accountId);
    const response = await GET(new NextRequest("https://example.invalid/api/tasks", { headers }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success", tasks: [] });
    expect(getAccountIdByApiKey).toHaveBeenCalledExactlyOnceWith(key);
    expect(selectScheduledActions).toHaveBeenCalledOnce();
    expect(createTask).not.toHaveBeenCalled();
    expect(updateTask).not.toHaveBeenCalled();
    expect(deleteTask).not.toHaveBeenCalled();
    expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
