import { describe, expect, it } from "vitest";
import { validatePublicUploadBytes } from "../validatePublicUploadBytes";
describe("public upload content validation", () => {
  it.each([
    ["image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
    ["image/jpeg", Buffer.from([255, 216, 255])],
    ["image/gif", Buffer.from("GIF89a")],
    ["image/webp", Buffer.from("RIFF0000WEBP")],
    ["application/pdf", Buffer.from("%PDF-1.7")],
    ["audio/mpeg", Buffer.from("ID3")],
    ["audio/wav", Buffer.from("RIFF0000WAVE")],
    ["audio/x-m4a", Buffer.from("0000ftypM4A ")],
    ["audio/webm", Buffer.from([26, 69, 223, 163])],
    ["text/plain", Buffer.from("hello α")],
    ["text/markdown", Buffer.from("# Hello")],
    ["text/x-markdown", Buffer.from("# Hello")],
    ["text/csv", Buffer.from("first,last\na,b")],
    ["application/json", Buffer.from('{"valid":true}')],
  ])("accepts supported signature/text for %s", (mime, bytes) => {
    expect(validatePublicUploadBytes(bytes as Buffer, mime as string)).toBe(true);
  });
  it.each([
    "image/svg+xml",
    "text/html",
    "application/octet-stream",
    "image/png",
    "application/json",
  ])("rejects unsupported or mismatched %s", mime => {
    expect(validatePublicUploadBytes(Buffer.from("invalid"), mime)).toBe(false);
  });
});
