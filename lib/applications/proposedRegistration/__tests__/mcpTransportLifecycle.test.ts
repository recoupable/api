import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createProposedRegistrationMcpLifetime } from "@/lib/mcp/applications/createProposedRegistrationMcpLifetime";

import { beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { handleProposedRegistrationMcpRequest as handle } from "@/lib/mcp/applications/handleProposedRegistrationMcpRequest";
import { fixture } from "../../../../scripts/application-registration-proposal/setup";
import golden from "../../../../scripts/application-registration-proposal/receipt-golden.json";
import type { ProposedDependencies } from "../proposedRegistrationContract";
import supabase from "@/lib/supabase/serverClient";
import * as domain from "../createProposedApplicationRegistration";
afterEach(() => vi.useRealTimers());
it("bounds a hung asynchronous stage and closes once", async () => {
  vi.useFakeTimers();
  const life = createProposedRegistrationMcpLifetime(
    new NextRequest("https://fixture.invalid/mcp"),
  );
  const close = vi.fn(async () => {});
  life.own(close);
  const result = life.run(() => new Promise(() => {})).catch(e => e);
  await vi.advanceTimersByTimeAsync(30000);
  expect(await result).toBeInstanceOf(Response);
  await life.close();
  await life.close();
  expect(close).toHaveBeenCalledTimes(1);
  expect(life.terminated()).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("separately bounds failed cleanup", async () => {
  vi.useFakeTimers();
  const life = createProposedRegistrationMcpLifetime(
    new NextRequest("https://fixture.invalid/mcp"),
  );
  life.own(() => new Promise(() => {}));
  const result = life.close().catch(e => e);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await result).toBeInstanceOf(Error);
  expect(vi.getTimerCount()).toBe(0);
});
beforeEach(() => {
  vi.stubEnv("OAUTH_ENABLED", "false");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const dependencies = () => ({
  policy: {
    status: "proposed_unadopted",
    version: "proposed-personal-v1",
    databaseHead: golden.databaseHead,
  } as ProposedDependencies["policy"],
  storage: {
    create: vi.fn<ProposedDependencies["storage"]["create"]>(async () =>
      structuredClone(golden.createReceipt),
    ),
    read: vi.fn<ProposedDependencies["storage"]["read"]>(async () =>
      structuredClone(golden.readReceipt),
    ),
  },
});
function req(signal?: AbortSignal, method = "tools/call") {
  return new NextRequest("https://fixture.invalid/mcp", {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${fixture.key}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        name: "create_application_registration",
        arguments: {
          idempotency_key: golden.input.key,
          expected_entitlement_revision: 1,
          registration: {
            name: golden.input.registration.name,
            environment: "production",
            allowed_origins: golden.input.registration.origins.map(o => o.origin),
            return_urls: golden.input.registration.origins.flatMap(o => o.return_urls),
          },
        },
      },
    }),
  });
}
function barrier<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
it("closes SDK before returning JSON, even when the caller cancels the response body", async () => {
  const close = vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "close");
  const response = await handle(req(undefined, "tools/list"), dependencies());
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(close).toHaveBeenCalledTimes(1);
  await response.body?.cancel();
  expect(close).toHaveBeenCalledTimes(1);
});
it.each(["resolve", "reject"] as const)(
  "after storage entry, abort closes transport but late %s is not rollback or retry",
  async settle => {
    const abort = new AbortController();
    const entered = barrier<void>();
    const storage = barrier<unknown>();
    const d = dependencies();
    let settled = false;
    d.storage.create.mockImplementation(async () => {
      entered.resolve();
      try {
        return await storage.promise;
      } finally {
        settled = true;
      }
    });
    const close = vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "close");
    const response = handle(req(abort.signal), d);
    await entered.promise;
    abort.abort();
    expect((await response).status).toBe(408);
    expect(close).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    if (settle === "resolve") storage.resolve(golden.createReceipt);
    else storage.reject(new Error("PRIVATE_SENTINEL"));
    await vi.waitFor(() => expect(settled).toBe(true));
    expect(d.storage.create).toHaveBeenCalledTimes(1);
  },
);
it("abort during fresh domain lookup prevents late storage invocation", async () => {
  const abort = new AbortController();
  const entered = barrier<void>();
  const resume = barrier<void>();
  const original = supabase.from.bind(supabase);
  let calls = 0;
  vi.spyOn(supabase, "from").mockImplementation(table => {
    const query = original(table);
    if (++calls !== 3) return query;
    const select = query.select.bind(query);
    return {
      ...query,
      select: (...args: Parameters<typeof select>) => {
        const selection = select(...args);
        const eq = selection.eq.bind(selection);
        return {
          ...selection,
          eq: async (...params: Parameters<typeof eq>) => {
            entered.resolve();
            await resume.promise;
            return eq(...params);
          },
        };
      },
    };
  });
  const finished = barrier<void>();
  const actualCreate = domain.createProposedApplicationRegistration;
  vi.spyOn(domain, "createProposedApplicationRegistration").mockImplementation(async (...args) => {
    try {
      return await actualCreate(...args);
    } finally {
      finished.resolve();
    }
  });
  const d = dependencies();
  const response = handle(req(abort.signal), d);
  await entered.promise;
  abort.abort();
  expect((await response).status).toBe(408);
  resume.resolve();
  await finished.promise;
  expect(d.storage.create).not.toHaveBeenCalled();
});
it("bounds truly pending admission and observes its late rejection", async () => {
  vi.useFakeTimers();
  const pending = barrier<never>();
  const original = supabase.from.bind(supabase);
  vi.spyOn(supabase, "from").mockImplementation(table => {
    const query = original(table);
    const select = query.select.bind(query);
    return {
      ...query,
      select: (...args: Parameters<typeof select>) => ({
        ...select(...args),
        eq: () => pending.promise,
      }),
    };
  });
  const response = handle(req(), dependencies());
  await vi.advanceTimersByTimeAsync(30000);
  expect((await response).status).toBe(504);
  pending.reject(new Error("PRIVATE_SENTINEL"));
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(0);
});
it("body timeout cancels the owned input and closes its deadline", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const original = req();
  const body = new ReadableStream<Uint8Array>({ pull() {}, cancel });
  const request = new NextRequest(original.url, {
    method: "POST",
    headers: original.headers,
    body,
    duplex: "half",
  } as RequestInit);
  const response = handle(request, dependencies());
  await vi.advanceTimersByTimeAsync(5001);
  expect((await response).status).toBe(408);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
it("close failure cannot be reported as successful cleanup", async () => {
  vi.spyOn(McpServer.prototype, "close").mockRejectedValueOnce(new Error("PRIVATE_SENTINEL"));
  const response = await handle(req(undefined, "tools/list"), dependencies());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("PRIVATE_SENTINEL");
});

it("bounds connect, closes its attached transport, and blocks late continuation", async () => {
  vi.useFakeTimers();
  const resume = barrier<void>();
  const original = WebStandardStreamableHTTPServerTransport.prototype.start;
  vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "start").mockImplementation(
    async function () {
      await original.call(this);
      await resume.promise;
    },
  );
  const close = vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "close");
  const dispatch = vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "handleRequest");
  const d = dependencies();
  const response = handle(req(), d);
  await vi.advanceTimersByTimeAsync(30000);
  expect((await response).status).toBe(504);
  expect(close).toHaveBeenCalledTimes(1);
  resume.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(dispatch).not.toHaveBeenCalled();
  expect(d.storage.create).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("bounds the SDK's pending JSON promise separately from late domain settlement", async () => {
  vi.useFakeTimers();
  const pending = barrier<unknown>();
  let settled = false;
  const d = dependencies();
  d.storage.create.mockImplementation(async () => {
    try {
      return await pending.promise;
    } finally {
      settled = true;
    }
  });
  const response = handle(req(), d);
  await vi.advanceTimersByTimeAsync(30000);
  expect((await response).status).toBe(504);
  expect(d.storage.create).toHaveBeenCalledTimes(1);
  expect(settled).toBe(false);
  pending.resolve(golden.createReceipt);
  await vi.advanceTimersByTimeAsync(0);
  expect(settled).toBe(true);
  expect(d.storage.create).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
it("bounds an uncooperative SDK close independently", async () => {
  vi.useFakeTimers();
  const close = barrier<void>();
  const original = WebStandardStreamableHTTPServerTransport.prototype.close;
  vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "close").mockImplementation(
    async function () {
      await original.call(this);
      await close.promise;
    },
  );
  const response = handle(req(undefined, "tools/list"), dependencies());
  await vi.advanceTimersByTimeAsync(1001);
  expect((await response).status).toBe(503);
  close.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(0);
});
it("pre-aborted requests never enter authentication or SDK allocation", async () => {
  const abort = new AbortController();
  abort.abort();
  const connect = vi.spyOn(McpServer.prototype, "connect");
  expect((await handle(req(abort.signal), dependencies())).status).toBe(408);
  expect(fixture.queries).toEqual([]);
  expect(connect).not.toHaveBeenCalled();
});
it.each(["accept", "length", "auth"])("cancels unread body on early %s denial", async kind => {
  const cancel = vi.fn();
  const original = req();
  if (kind === "accept") original.headers.set("accept", "application/json");
  if (kind === "length") original.headers.set("content-length", "65537");
  if (kind === "auth") original.headers.set("authorization", "Basic invalid");
  const body = new ReadableStream<Uint8Array>({ cancel });
  const request = new NextRequest(original.url, {
    method: "POST",
    headers: original.headers,
    body,
    duplex: "half",
  } as RequestInit);
  expect((await handle(request, dependencies())).status).toBe(
    kind === "auth" ? 401 : kind === "accept" ? 406 : 413,
  );
  expect(cancel).toHaveBeenCalledTimes(1);
});
it("reports a noncooperative unread-body cleanup instead of claiming disposal", async () => {
  vi.useFakeTimers();
  const blocked = barrier<void>();
  const original = req();
  original.headers.set("content-length", "65537");
  const body = new ReadableStream<Uint8Array>({ cancel: () => blocked.promise });
  const request = new NextRequest(original.url, {
    method: "POST",
    headers: original.headers,
    body,
    duplex: "half",
  } as RequestInit);
  const response = handle(request, dependencies());
  await vi.advanceTimersByTimeAsync(1001);
  expect((await response).status).toBe(503);
  blocked.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(0);
});
it.each(["registration", "connect"])("owns teardown when %s fails", async stage => {
  const close = vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "close");
  if (stage === "registration")
    vi.spyOn(McpServer.prototype, "registerTool").mockImplementationOnce(() => {
      throw new Error("PRIVATE_SENTINEL");
    });
  else
    vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "start").mockRejectedValueOnce(
      new Error("PRIVATE_SENTINEL"),
    );
  const d = dependencies();
  const response = await handle(req(), d);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("PRIVATE_SENTINEL");
  expect(close).toHaveBeenCalledTimes(1);
  expect(d.storage.create).not.toHaveBeenCalled();
});
