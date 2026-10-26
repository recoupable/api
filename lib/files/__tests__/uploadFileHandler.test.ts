import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { uploadFileHandler } from "../uploadFileHandler";
import { validateAuthContext } from "@/lib/auth/validateAuthContext";
import { uploadPublicAsset } from "../uploadPublicAsset";

vi.mock("@/lib/auth/validateAuthContext", () => ({ validateAuthContext: vi.fn() }));
vi.mock("../uploadPublicAsset", () => ({ uploadPublicAsset: vi.fn() }));
const accountId = "00000000-0000-4000-8000-000000000001";
const file = (bytes = "hello", type = "text/plain") => new File([bytes], "notes.txt", { type });
function request(value: File = file(), extra?: (form: FormData) => void) {
  const form = new FormData();
  form.append("file", value);
  extra?.(form);
  return new NextRequest("https://api.example/api/upload?account_id=foreign", {
    method: "POST",
    body: form,
    headers: { authorization: "Bearer synthetic" },
  });
}
describe("authenticated public upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAuthContext).mockResolvedValue({
      accountId,
      orgId: null,
      authToken: "synthetic",
    });
    vi.mocked(uploadPublicAsset).mockResolvedValue({
      url: "https://storage.example/public/file",
      storageKey: `${accountId}/id`,
    });
  });
  it("authenticates existing accounts before consuming the body or uploading", async () => {
    vi.mocked(validateAuthContext).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const req = request();
    const response = await uploadFileHandler(req);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ success: false, error: "Unauthorized" });
    expect(req.bodyUsed).toBe(false);
    expect(uploadPublicAsset).not.toHaveBeenCalled();
    expect(validateAuthContext).toHaveBeenCalledWith(req, { allowAccountCreation: false });
  });
  it("preserves exact bytes and wire contract, derives uploader from auth", async () => {
    const response = await uploadFileHandler(request(file("hello\n")));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      fileName: "notes.txt",
      fileType: "text/plain",
      fileSize: 6,
      url: "https://storage.example/public/file",
    });
    expect(uploadPublicAsset).toHaveBeenCalledWith({
      data: Buffer.from("hello\n"),
      contentType: "text/plain",
      uploaderAccountId: accountId,
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
  it.each(["", "application/octet-stream", "text/html", "image/svg+xml"])(
    "rejects unsupported MIME %s",
    async type => {
      expect((await uploadFileHandler(request(file("hello", type)))).status).toBe(415);
      expect(uploadPublicAsset).not.toHaveBeenCalled();
    },
  );
  it("rejects binary content disguised as an accepted image", async () => {
    expect((await uploadFileHandler(request(file("not an image", "image/png")))).status).toBe(415);
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });
  it("rejects invalid JSON and non-UTF8 text", async () => {
    expect((await uploadFileHandler(request(file("{bad", "application/json")))).status).toBe(415);
    expect(
      (
        await uploadFileHandler(
          request(new File([new Uint8Array([255])], "bad.txt", { type: "text/plain" })),
        )
      ).status,
    ).toBe(415);
  });
  it.each(["empty", "duplicate", "account override"])("rejects %s multipart input", async kind => {
    const req =
      kind === "empty"
        ? request(file(""))
        : request(file(), form =>
            form.append(
              kind === "duplicate" ? "file" : "account_id",
              kind === "duplicate" ? file() : "foreign",
            ),
          );
    expect((await uploadFileHandler(req)).status).toBe(400);
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });
  it("rejects malformed multipart and wrong content type", async () => {
    for (const type of ["multipart/form-data; boundary=x", "application/json"]) {
      const req = new NextRequest("https://api.example/api/upload", {
        method: "POST",
        body: "invalid",
        headers: { "content-type": type },
      });
      expect((await uploadFileHandler(req)).status).toBe(400);
    }
  });
  it("rejects files above 4 MiB even below the overall multipart cap", async () => {
    expect((await uploadFileHandler(request(file("a".repeat(4 * 1024 * 1024 + 1))))).status).toBe(
      413,
    );
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });
  it("accepts an exactly 4 MiB file with normal multipart overhead", async () => {
    const response = await uploadFileHandler(request(file("a".repeat(4 * 1024 * 1024))));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ fileSize: 4 * 1024 * 1024 });
  });
  it("caps chunked bodies independently of missing or forged content length", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 65537));
      },
      cancel,
    });
    const req = new NextRequest("https://api.example/api/upload", {
      method: "POST",
      body: stream,
      duplex: "half",
      headers: { "content-type": "multipart/form-data; boundary=x", "content-length": "1" },
    } as never);
    expect((await uploadFileHandler(req)).status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(uploadPublicAsset).not.toHaveBeenCalled();
  });
  it("rejects oversized advertised bodies without reading", async () => {
    const req = request();
    req.headers.set("content-length", "5000000");
    expect((await uploadFileHandler(req)).status).toBe(413);
    expect(req.bodyUsed).toBe(false);
  });
  it("returns a generic error on storage failure without leaking provider details", async () => {
    vi.mocked(uploadPublicAsset).mockRejectedValue(new Error("private provider detail"));
    const response = await uploadFileHandler(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, error: "Could not upload file" });
  });
});
