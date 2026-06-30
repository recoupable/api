import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { readRawBody } from "../readRawBody";

describe("readRawBody", () => {
  it("returns the body verbatim", async () => {
    const raw = '{"subject":"Hi","html":"<p>x</p>"}';
    const request = new NextRequest("http://localhost/api/emails", { method: "POST", body: raw });
    expect(await readRawBody(request)).toBe(raw);
  });

  it("returns an empty string for an empty body", async () => {
    const request = new NextRequest("http://localhost/api/emails", { method: "POST" });
    expect(await readRawBody(request)).toBe("");
  });

  it("returns an empty string when reading the body throws", async () => {
    const broken = {
      text: () => Promise.reject(new Error("stream consumed")),
    } as unknown as NextRequest;
    expect(await readRawBody(broken)).toBe("");
  });
});
