import Ajv from "ajv";
import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST, PATCH, DELETE } from "@/app/api/tasks/route";
import { getAccountIdByApiKey } from "@/lib/auth/getAccountIdByApiKey";
import { getOrCreateAccountIdByAuthToken } from "@/lib/privy/getOrCreateAccountIdByAuthToken";
import { canAccessAccount } from "@/lib/organizations/canAccessAccount";
import { checkIsAdmin } from "@/lib/admins/checkIsAdmin";
import { getCorsHeaders } from "@/lib/networking/getCorsHeaders";
import { selectScheduledActions } from "@/lib/supabase/scheduled_actions/selectScheduledActions";
import { updateScheduledAction } from "@/lib/supabase/scheduled_actions/updateScheduledAction";
import { deleteScheduledAction } from "@/lib/supabase/scheduled_actions/deleteScheduledAction";
import { createTask } from "@/lib/tasks/createTask";
import { enrichTasks } from "@/lib/tasks/enrichTasks";
import { syncTriggerSchedule } from "@/lib/trigger/syncTriggerSchedule";
import { deleteSchedule } from "@/lib/trigger/deleteSchedule";
import type { Tables } from "@/types/database.types";
import fixture from "../fixtures/published-docs.json";

vi.mock("@/lib/supabase/serverClient", () => ({ default: {} }));
vi.mock("@/lib/auth/getAccountIdByApiKey", () => ({ getAccountIdByApiKey: vi.fn() }));
vi.mock("@/lib/privy/getOrCreateAccountIdByAuthToken", () => ({
  getOrCreateAccountIdByAuthToken: vi.fn(),
}));
vi.mock("@/lib/organizations/canAccessAccount", () => ({ canAccessAccount: vi.fn() }));
vi.mock("@/lib/admins/checkIsAdmin", () => ({ checkIsAdmin: vi.fn() }));
vi.mock("@/lib/supabase/scheduled_actions/selectScheduledActions", () => ({
  selectScheduledActions: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/updateScheduledAction", () => ({
  updateScheduledAction: vi.fn(),
}));
vi.mock("@/lib/supabase/scheduled_actions/deleteScheduledAction", () => ({
  deleteScheduledAction: vi.fn(),
}));
vi.mock("@/lib/tasks/createTask", () => ({ createTask: vi.fn() }));
vi.mock("@/lib/tasks/enrichTasks", () => ({ enrichTasks: vi.fn() }));
vi.mock("@/lib/trigger/syncTriggerSchedule", () => ({ syncTriggerSchedule: vi.fn() }));
vi.mock("@/lib/trigger/deleteSchedule", () => ({ deleteSchedule: vi.fn() }));
vi.mock("@/lib/plans/assertTaskWithinPlan", () => ({ assertTaskWithinPlan: vi.fn() }));
vi.mock("@/lib/plans/getTaskRunBlock", () => ({ getTaskRunBlock: vi.fn() }));

type Method = "GET" | "POST" | "PATCH" | "DELETE";
interface ResponseContract {
  method: string;
  path: string;
  status: number;
  schema: Record<string, unknown>;
  examples?: Record<string, unknown>;
}
const contracts = fixture.responseSchemas as unknown as ResponseContract[];
const id = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const targetAccountId = "33333333-3333-4333-8333-333333333333";
const createBody = {
  title: "Weekly update",
  prompt: "Summarize releases",
  schedule: "0 9 * * 1",
  artist_account_id: id,
};
const handlers = { GET, POST, PATCH, DELETE };
const targets: Array<{ method: Method; status: number; examples: string[] }> = [
  { method: "GET", status: 403, examples: ["accountOverrideDenied"] },
  { method: "POST", status: 403, examples: ["accountOverrideDenied"] },
  { method: "PATCH", status: 403, examples: ["accountOverrideDenied", "taskAccessDenied"] },
  { method: "DELETE", status: 403, examples: ["taskAccessDenied"] },
  { method: "GET", status: 500, examples: ["serviceError", "unexpectedFailure"] },
  { method: "POST", status: 500, examples: ["serviceError", "unexpectedFailure"] },
];

function contractFor(method: Method, status: number) {
  const record = contracts.find(
    item => item.method === method && item.path === "/api/tasks" && item.status === status,
  );
  expect(record, `Missing ${method} /api/tasks ${status} contract`).toBeDefined();
  return record!;
}

function request(method: Method, body?: unknown, query = "") {
  return new NextRequest("https://example.invalid/api/tasks" + query, {
    method,
    headers: { "x-api-key": "synthetic-key" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function expectNoWrites() {
  for (const leaf of [
    updateScheduledAction,
    deleteScheduledAction,
    syncTriggerSchedule,
    deleteSchedule,
  ])
    expect(leaf).not.toHaveBeenCalled();
}

async function expectFailure(
  response: NextResponse,
  method: Method,
  status: number,
  example: string,
) {
  expect(response.status).toBe(status);
  const result = await response.json();
  const record = contractFor(method, status);
  const matches = new Ajv({ strict: false, allErrors: true, validateFormats: false }).compile(
    record.schema,
  );
  expect(matches(result), JSON.stringify(matches.errors)).toBe(true);
  expect(record.examples).toBeDefined();
  expect(result).toEqual(record.examples![example]);
  for (const [name, value] of Object.entries(getCorsHeaders()))
    expect(response.headers.get(name)).toBe(value);
  expectNoWrites();
  expect(enrichTasks).not.toHaveBeenCalled();
  expect(getOrCreateAccountIdByAuthToken).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAccountIdByApiKey).mockResolvedValue(accountId);
  vi.mocked(canAccessAccount).mockResolvedValue(false);
  vi.mocked(checkIsAdmin).mockResolvedValue(false);
  vi.mocked(selectScheduledActions).mockResolvedValue([]);
  vi.mocked(enrichTasks).mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network access in task failure contract");
    }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("published task access and service failures", () => {
  it.each(targets)(
    "$method $status declares text-error examples",
    ({ method, status, examples }) => {
      const record = contractFor(method, status);
      expect(record.examples).toBeDefined();
      expect(Object.keys(record.examples!).sort()).toEqual([...examples].sort());
      const matches = new Ajv({ strict: false, validateFormats: false }).compile(record.schema);
      for (const value of Object.values(record.examples!)) expect(matches(value)).toBe(true);
      expect(matches({ error: status, message: "Failure" })).toBe(false);
      expect(matches({ status: "error" })).toBe(false);
      expect(matches({ status: "error", message: "Failure" })).toBe(false);
    },
  );

  it.each(["GET", "POST", "PATCH"] as const)(
    "%s preserves a denied account override",
    async method => {
      const body =
        method === "POST"
          ? { ...createBody, account_id: targetAccountId }
          : method === "PATCH"
            ? { id, title: "Updated", account_id: targetAccountId }
            : undefined;
      const response = await handlers[method](
        request(method, body, method === "GET" ? "?account_id=" + targetAccountId : ""),
      );
      await expectFailure(response, method, 403, "accountOverrideDenied");
      expect(canAccessAccount).toHaveBeenCalledExactlyOnceWith({
        currentAccountId: accountId,
        targetAccountId,
      });
      expect(selectScheduledActions).not.toHaveBeenCalled();
      expect(createTask).not.toHaveBeenCalled();
    },
  );

  it.each(["PATCH", "DELETE"] as const)(
    "%s preserves the real task-owner denial before writes",
    async method => {
      vi.mocked(selectScheduledActions).mockResolvedValue([
        { id, account_id: targetAccountId } as Tables<"scheduled_actions">,
      ]);
      const response = await handlers[method](request(method, { id }));
      await expectFailure(response, method, 403, "taskAccessDenied");
      expect(selectScheduledActions).toHaveBeenCalledExactlyOnceWith({ id });
      expect(canAccessAccount).toHaveBeenCalledExactlyOnceWith({
        currentAccountId: accountId,
        targetAccountId,
      });
      expect(createTask).not.toHaveBeenCalled();
    },
  );

  for (const method of ["GET", "POST"] as const) {
    it.each(["serviceError", "unexpectedFailure"])(
      `${method} returns the documented %s envelope`,
      async example => {
        const failure =
          example === "serviceError"
            ? new Error("Task service unavailable")
            : "synthetic non-Error";
        if (method === "GET") vi.mocked(selectScheduledActions).mockRejectedValue(failure);
        else vi.mocked(createTask).mockRejectedValue(failure);
        const response = await handlers[method](
          request(method, method === "POST" ? createBody : undefined),
        );
        await expectFailure(response, method, 500, example);
      },
    );
  }

  it("preserves an allowed account-override GET without task writes", async () => {
    vi.mocked(canAccessAccount).mockResolvedValue(true);
    const response = await GET(request("GET", undefined, "?account_id=" + targetAccountId));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "success", tasks: [] });
    expect(selectScheduledActions).toHaveBeenCalledExactlyOnceWith({ account_id: targetAccountId });
    expect(createTask).not.toHaveBeenCalled();
    expectNoWrites();
    expect(fetch).not.toHaveBeenCalled();
  });
});
