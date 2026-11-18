import { readProposedRegistrationMcpBody } from "@/lib/mcp/applications/readProposedRegistrationMcpBody";
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
function observeDomainCompletion(onEnter = () => {}) {
  const finished = barrier<void>();
  let complete = false;
  const actualCreate = domain.createProposedApplicationRegistration;
  vi.spyOn(domain, "createProposedApplicationRegistration").mockImplementation(async (...args) => {
    onEnter();
    try {
      return await actualCreate(...args);
    } finally {
      complete = true;
      finished.resolve();
    }
  });
  return { finished: finished.promise, isComplete: () => complete };
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
    const completion = observeDomainCompletion();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const send = vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "send");
    d.storage.create.mockImplementation(async () => {
      entered.resolve();
      return storage.promise;
    });
    const close = vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "close");
    const response = handle(req(abort.signal), d);
    await entered.promise;
    abort.abort();
    const delivered = await response;
    const originalBody = await delivered.clone().text();
    expect(delivered.status).toBe(408);
    expect(close).toHaveBeenCalledTimes(1);
    expect(completion.isComplete()).toBe(false);
    const sendsAtAbort = send.mock.calls.length;
    if (settle === "resolve") storage.resolve(golden.createReceipt);
    else storage.reject(new Error("PRIVATE_SENTINEL"));
    await completion.finished;
    expect(completion.isComplete()).toBe(true);
    expect(d.storage.create).toHaveBeenCalledTimes(1);
    expect(await response).toBe(delivered);
    expect(await delivered.text()).toBe(originalBody);
    expect(originalBody).not.toMatch(/PRIVATE_SENTINEL|receipt_id/);
    expect(send).toHaveBeenCalledTimes(sendsAtAbort);
    expect(errors).not.toHaveBeenCalled();
  },
);
it("abort during fresh domain lookup prevents late storage invocation", async () => {
  const abort = new AbortController();
  const entered = barrier<void>();
  const resume = barrier<void>();
  const original = supabase.from.bind(supabase);
  let inDomain = false;
  const gated = vi.fn();
  vi.spyOn(supabase, "from").mockImplementation(table => {
    const query = original(table);
    if (!inDomain || table !== "account_api_keys") return query;
    const select = query.select.bind(query);
    return {
      ...query,
      select: (...args: Parameters<typeof select>) => {
        const selection = select(...args);
        const eq = selection.eq.bind(selection);
        return {
          ...selection,
          eq: async (...params: Parameters<typeof eq>) => {
            expect(params[0]).toBe("key_hash");
            gated(table, params[0]);
            entered.resolve();
            await resume.promise;
            return eq(...params);
          },
        };
      },
    };
  });
  const completion = observeDomainCompletion(() => {
    inDomain = true;
  });
  const d = dependencies();
  const response = handle(req(abort.signal), d);
  await entered.promise;
  expect(gated).toHaveBeenCalledExactlyOnceWith("account_api_keys", "key_hash");
  expect(completion.isComplete()).toBe(false);
  abort.abort();
  expect((await response).status).toBe(408);
  resume.resolve();
  await completion.finished;
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
  expect(await (await response).json()).toEqual({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Request body timeout" },
    id: null,
  });
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
  const completion = observeDomainCompletion();
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const send = vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "send");
  const d = dependencies();
  d.storage.create.mockImplementation(() => pending.promise);
  const response = handle(req(), d);
  await vi.advanceTimersByTimeAsync(30000);
  const delivered = await response;
  const originalBody = await delivered.clone().text();
  expect(delivered.status).toBe(504);
  expect(d.storage.create).toHaveBeenCalledTimes(1);
  expect(completion.isComplete()).toBe(false);
  const sendsAtDeadline = send.mock.calls.length;
  pending.resolve(golden.createReceipt);
  await completion.finished;
  expect(completion.isComplete()).toBe(true);
  expect(d.storage.create).toHaveBeenCalledTimes(1);
  expect(await response).toBe(delivered);
  expect(await delivered.text()).toBe(originalBody);
  expect(originalBody).not.toMatch(/PRIVATE_SENTINEL|receipt_id/);
  expect(send).toHaveBeenCalledTimes(sendsAtDeadline);
  expect(errors).not.toHaveBeenCalled();
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

it.each(["closed", "closing", "aborted"])(
  "does not acquire or leave a reader locked for an owner already %s",
  async state => {
    const abort = new AbortController();
    const request = req(abort.signal);
    const life = createProposedRegistrationMcpLifetime(request);
    const cleanup = barrier<void>();
    let closing: Promise<void> | undefined;
    if (state === "closing") {
      life.own(() => cleanup.promise);
      closing = life.close();
    } else if (state === "closed") await life.close();
    else abort.abort();
    let acquired: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>> | undefined;
    const actualGetReader = request.body!.getReader.bind(request.body!);
    const getReader = vi.spyOn(request.body!, "getReader").mockImplementation(() => {
      acquired = actualGetReader();
      return acquired;
    });
    try {
      expect(request.body!.locked).toBe(false);
      const terminal = await life.run(async () => undefined).catch(error => error);
      expect(terminal).toBeInstanceOf(Response);
      expect(terminal.status).toBe(408);
      await expect(readProposedRegistrationMcpBody(request, life)).rejects.toBe(terminal);
      expect(request.body!.locked).toBe(false);
      expect(getReader).not.toHaveBeenCalled();
    } finally {
      // Keep the deliberately failing RED regression from leaving its unowned reader locked.
      cleanup.resolve();
      try {
        await (closing ?? life.close());
      } finally {
        acquired?.releaseLock();
      }
    }
  },
);
