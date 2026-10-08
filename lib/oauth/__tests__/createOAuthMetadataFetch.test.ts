import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createOAuthMetadataFetch } from "../createOAuthMetadataFetch";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
let status = 200;
let headers: Record<string, string>;
let body: string;
beforeEach(() => {
  vi.clearAllMocks();
  status = 200;
  headers = { "content-type": "application/json", "cache-control": "max-age=600" };
  body = '{"client_id":"https://agent.example/client.json"}';
  mocks.lookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
  mocks.request.mockImplementation((_url, options, callback) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
    req.destroy = vi.fn();
    req.end = () =>
      queueMicrotask(() => {
        options.lookup("agent.example", { all: true }, (error: Error | null, records: unknown) => {
          expect(error).toBeNull();
          expect(records).toEqual([{ address: "1.1.1.1", family: 4 }]);
        });
        const response = Object.assign(new PassThrough(), { statusCode: status, headers });
        callback(response);
        response.end(body);
      });
    return req;
  });
});
afterEach(() => vi.restoreAllMocks());
it("pins the connection to validated DNS and forwards no caller credentials", async () => {
  const response = await createOAuthMetadataFetch()("https://agent.example/client.json", {
    headers: { authorization: "secret", cookie: "secret" },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toHaveProperty("client_id");
  expect(response.headers.get("cache-control")).toBe("max-age=300");
  expect(mocks.lookup).toHaveBeenCalledTimes(1);
  expect(mocks.request.mock.calls[0][1]).toMatchObject({ agent: false, method: "GET" });
  expect(JSON.stringify(mocks.request.mock.calls)).not.toContain("secret");
});
it.each([
  [{ address: "127.0.0.1", family: 4 }],
  [
    { address: "1.1.1.1", family: 4 },
    { address: "10.0.0.1", family: 4 },
  ],
  [],
])("rejects unsafe or empty DNS results", async (...records) => {
  mocks.lookup.mockResolvedValue(records);
  await expect(createOAuthMetadataFetch()("https://agent.example/client.json")).rejects.toThrow();
  expect(mocks.request).not.toHaveBeenCalled();
});
it.each([301, 302, 307, 404, 500])("rejects HTTP %s without following redirects", async code => {
  status = code;
  headers.location = "https://127.0.0.1/secret";
  await expect(createOAuthMetadataFetch()("https://agent.example/client.json")).rejects.toThrow();
  expect(mocks.request).toHaveBeenCalledTimes(1);
});
it("rejects advertised and streamed oversized bodies", async () => {
  headers["content-length"] = "20000";
  await expect(createOAuthMetadataFetch()("https://agent.example/client.json")).rejects.toThrow();
  delete headers["content-length"];
  body = "x".repeat(16385);
  await expect(createOAuthMetadataFetch()("https://agent.example/client.json")).rejects.toThrow();
});
it.each([
  { "content-type": "text/html" },
  { "content-type": "application/json", "content-encoding": "gzip" },
])("rejects unexpected representation %o", async value => {
  headers = value;
  await expect(createOAuthMetadataFetch()("https://agent.example/client.json")).rejects.toThrow();
});
it("aborts during DNS without starting a request", async () => {
  let resolve: (value: unknown) => void = () => {};
  mocks.lookup.mockImplementation(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  const controller = new AbortController();
  const pending = createOAuthMetadataFetch()("https://agent.example/client.json", {
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).rejects.toThrow();
  resolve([{ address: "1.1.1.1", family: 4 }]);
  await Promise.resolve();
  expect(mocks.request).not.toHaveBeenCalled();
});

it("enforces a wall-clock deadline even if DNS never responds", async () => {
  mocks.lookup.mockImplementation(() => new Promise(() => {}));
  await expect(createOAuthMetadataFetch()("https://agent.example/client.json")).rejects.toThrow(
    "aborted",
  );
  expect(mocks.request).not.toHaveBeenCalled();
});

it("bounds concurrent fetches and releases capacity after cancellation", async () => {
  mocks.lookup.mockImplementation(() => new Promise(() => {}));
  const fetchMetadata = createOAuthMetadataFetch();
  const controller = new AbortController();
  const pending = Array.from({ length: 8 }, () =>
    fetchMetadata("https://agent.example/client.json", { signal: controller.signal }).catch(
      error => error,
    ),
  );
  await expect(fetchMetadata("https://agent.example/client.json")).rejects.toThrow("unavailable");
  controller.abort();
  await Promise.all(pending);
  mocks.lookup.mockResolvedValue([{ address: "1.1.1.1", family: 4 }]);
  expect((await fetchMetadata("https://agent.example/client.json")).status).toBe(200);
});

it("aborts a stalled response body", async () => {
  let response: PassThrough;
  mocks.request.mockImplementation((_url, _options, callback) => {
    const req = Object.assign(new EventEmitter(), {
      destroy: vi.fn(),
      end: () => {
        response = Object.assign(new PassThrough(), { statusCode: 200, headers });
        callback(response);
      },
    });
    return req;
  });
  const controller = new AbortController();
  const pending = createOAuthMetadataFetch()("https://agent.example/client.json", {
    signal: controller.signal,
  });
  await Promise.resolve();
  controller.abort();
  await expect(pending).rejects.toThrow("aborted");
  expect(response!.destroyed).toBe(true);
});
