import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validatePostLeadBody } from "@/lib/notifications/validatePostLeadBody";

describe("validatePostLeadBody", () => {
  it("accepts the minimum a lead needs to be actionable", () => {
    const result = validatePostLeadBody({ email: "ada@example.com", source: "/audit" });
    expect(result).toEqual({ email: "ada@example.com", source: "/audit" });
  });

  it("passes the optional triage fields through", () => {
    const result = validatePostLeadBody({
      email: "ada@example.com",
      source: "/advisory/book",
      name: "Ada Lovelace",
      company: "Test Co",
      role: "Label Owner / GM",
      package: "Retained Advisor ($5,000/mo)",
      rosterSize: "21-50 artists",
      message: "hello",
    });
    expect(result).toMatchObject({ company: "Test Co", role: "Label Owner / GM" });
  });

  it("400s on a malformed email", () => {
    const result = validatePostLeadBody({ email: "not-an-email", source: "/audit" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("400s when source is missing — an unattributed lead cannot be triaged", () => {
    const result = validatePostLeadBody({ email: "ada@example.com" });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("400s on a non-object body", () => {
    expect(validatePostLeadBody(null)).toBeInstanceOf(NextResponse);
  });
});
