import { describe, it, expect } from "vitest";
import { isSafeHttpUrl } from "../isSafeHttpUrl";

describe("isSafeHttpUrl", () => {
  it("accepts public https URLs", () => {
    expect(isSafeHttpUrl("https://example.com/avatar.png")).toBe(true);
    expect(isSafeHttpUrl("http://cdn.instagram.com/img.jpg")).toBe(true);
  });

  it("rejects malformed URLs", () => {
    expect(isSafeHttpUrl("not a url")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
  });

  it("rejects non-http(s) protocols", () => {
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeHttpUrl("ftp://example.com")).toBe(false);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects loopback hostnames", () => {
    expect(isSafeHttpUrl("http://localhost")).toBe(false);
    expect(isSafeHttpUrl("http://foo.localhost")).toBe(false);
    expect(isSafeHttpUrl("http://127.0.0.1")).toBe(false);
    expect(isSafeHttpUrl("http://127.5.6.7")).toBe(false);
  });

  it("rejects RFC1918 private IPv4", () => {
    expect(isSafeHttpUrl("http://10.0.0.1")).toBe(false);
    expect(isSafeHttpUrl("http://192.168.1.1")).toBe(false);
    expect(isSafeHttpUrl("http://172.16.0.1")).toBe(false);
    expect(isSafeHttpUrl("http://172.31.255.255")).toBe(false);
  });

  it("accepts public IPv4 outside 172.16/12", () => {
    expect(isSafeHttpUrl("http://172.15.0.1")).toBe(true);
    expect(isSafeHttpUrl("http://172.32.0.1")).toBe(true);
  });

  it("rejects link-local IPv4 (169.254/16)", () => {
    expect(isSafeHttpUrl("http://169.254.169.254")).toBe(false);
  });

  it("rejects CGNAT range (100.64/10)", () => {
    expect(isSafeHttpUrl("http://100.64.0.1")).toBe(false);
    expect(isSafeHttpUrl("http://100.127.255.255")).toBe(false);
  });

  it("rejects multicast/reserved/broadcast IPv4", () => {
    expect(isSafeHttpUrl("http://224.0.0.1")).toBe(false);
    expect(isSafeHttpUrl("http://239.255.255.250")).toBe(false);
    expect(isSafeHttpUrl("http://240.0.0.1")).toBe(false);
    expect(isSafeHttpUrl("http://255.255.255.255")).toBe(false);
  });

  it("rejects IPv6 loopback (with brackets per WHATWG URL)", () => {
    expect(isSafeHttpUrl("http://[::1]")).toBe(false);
    expect(isSafeHttpUrl("http://[::]")).toBe(false);
  });

  it("rejects unique-local + link-local IPv6", () => {
    expect(isSafeHttpUrl("http://[fc00::1]")).toBe(false);
    expect(isSafeHttpUrl("http://[fd12::1]")).toBe(false);
    expect(isSafeHttpUrl("http://[fe80::1]")).toBe(false);
  });

  it("rejects IPv4-mapped IPv6 of private addresses", () => {
    expect(isSafeHttpUrl("http://[::ffff:10.0.0.1]")).toBe(false);
    expect(isSafeHttpUrl("http://[::ffff:127.0.0.1]")).toBe(false);
  });
});
