import { createHash, createHmac } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { backend } from "./authenticatedLifecycleBackend";
import { POST, GET } from "../route";

const bytes = "title,isrc\nSynthetic,TEST123\n";
const secret = "recoup_sk_synthetic_lifecycle";
function write(mode = "store", bearer = false) {
  return new NextRequest(
    `https://example.test/api/context/originals?sourceId=${backend.source}&idempotencyKey=synthetic-work&organizationId=${backend.owner}&mode=${mode}`,
    {
      method: "POST",
      body: bytes,
      headers: {
        "content-type": "text/csv",
        ...(bearer ? { authorization: `Bearer ${secret}` } : { "x-api-key": secret }),
      },
    },
  );
}
function read() {
  return new NextRequest(
    `https://example.test/api/context/originals?receiptId=${backend.saved?.id}&organizationId=${backend.owner}`,
    {
      headers: { authorization: `Bearer ${secret}` },
    },
  );
}
beforeEach(() => {
  Object.assign(backend, {
    member: true,
    withdrawn: false,
    loseAck: false,
    revokeOnDownload: false,
    withdrawOnDownload: false,
    stored: undefined,
    saved: undefined,
    path: "",
    uploads: 0,
    registrations: 0,
    admissions: 0,
    keyHash: createHmac("sha256", "synthetic-secret").update(secret).digest("hex"),
  });
  vi.stubEnv("CONTEXT_ORIGINAL_INTAKE_ENABLED", "true");
  vi.stubEnv("SUPABASE_URL", "https://storage.example.test");
  vi.stubEnv("SUPABASE_KEY", "synthetic-service-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      expect(request.url).toContain("/storage/v1/object/context-private/" + backend.path);
      expect(request.headers.get("authorization")).toBe("Bearer synthetic-service-key");
      if (backend.revokeOnDownload) backend.member = false;
      if (backend.withdrawOnDownload) backend.withdrawn = true;
      return new Response(backend.stored, { status: 200 });
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("authenticated originals lifecycle with synthetic backend", () => {
  it("writes through real API-key auth and reads in a new Bearer-key request", async () => {
    const response = await POST(write());
    expect(response.status).toBe(200);
    const receipt = await response.json();
    expect(receipt.fingerprint).toBe(createHash("sha256").update(bytes).digest("hex"));
    vi.resetModules();
    const fresh = await import("../route");
    const delivery = await fresh.GET(read());
    expect(delivery.status).toBe(200);
    expect(await delivery.text()).toBe(bytes);
    expect(delivery.headers.get("cache-control")).toContain("no-store");
    expect(backend.uploads).toBe(1);
    expect(backend.registrations).toBe(1);
  });
  it("recovers a committed registration after a lost reply without another upload", async () => {
    backend.loseAck = true;
    const uncertain = await POST(write());
    expect(uncertain.status).toBe(409);
    expect(await uncertain.text()).not.toContain(backend.path);
    const recovered = await POST(write("reconcile", true));
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).id).toBe(backend.saved?.id);
    expect(backend.uploads).toBe(1);
    expect(backend.registrations).toBe(2);
    expect((await GET(read())).status).toBe(200);
  });
  it("rejects an unknown credential before admission, body or storage", async () => {
    const request = write();
    request.headers.set("x-api-key", "recoup_sk_unknown");
    expect((await POST(request)).status).toBe(401);
    expect(backend.admissions).toBe(0);
    expect(backend.uploads).toBe(0);
    expect(backend.registrations).toBe(0);
  });
  it("keeps a lost-reply object when scope is revoked before explicit recovery", async () => {
    backend.loseAck = true;
    expect((await POST(write())).status).toBe(409);
    const retained = backend.stored;
    backend.member = false;
    expect((await POST(write("reconcile", true))).status).toBe(403);
    expect(backend.stored).toBe(retained);
    expect(backend.uploads).toBe(1);
    expect(backend.registrations).toBe(1);
  });
  it("denies revoked workspace membership before recovery or delivery", async () => {
    expect((await POST(write())).status).toBe(200);
    backend.member = false;
    expect((await POST(write("reconcile"))).status).toBe(403);
    expect((await GET(read())).status).toBe(403);
    expect(backend.uploads).toBe(1);
    expect(backend.registrations).toBe(1);
  });
  it("withholds bytes withdrawn during download at the final retained receipt read", async () => {
    expect((await POST(write())).status).toBe(200);
    backend.withdrawOnDownload = true;
    const denied = await GET(read());
    expect(denied.status).toBe(503);
    expect(await denied.text()).not.toContain(bytes);
  });
  it("withholds bytes when membership is revoked during actual SDK download", async () => {
    expect((await POST(write())).status).toBe(200);
    backend.revokeOnDownload = true;
    const denied = await GET(read());
    expect(denied.status).toBe(503);
    expect(await denied.text()).not.toContain(bytes);
  });
});
