import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { validatePostLeadsBody } from "@/lib/leads/validatePostLeadsBody";

const booking = {
  kind: "booking",
  email: "ada@example.com",
  source: "/advisory/book",
  name: "Ada Lovelace",
  company: "Test Co",
  package: "strategy-session",
  role: "Label Owner / GM",
  rosterSize: "21-50 artists",
  message: "hello",
};

const subscribe = {
  kind: "subscribe",
  email: "ada@example.com",
  source: "/audit",
};

describe("validatePostLeadsBody", () => {
  it("accepts a full booking", () => {
    expect(validatePostLeadsBody(booking)).toMatchObject({ kind: "booking" });
  });

  it("rejects a booking without a package — the triage field", () => {
    const result = validatePostLeadsBody({ ...booking, package: undefined });
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("rejects a booking without a name", () => {
    const result = validatePostLeadsBody({ ...booking, name: undefined });
    expect((result as NextResponse).status).toBe(400);
  });

  it("accepts a minimal subscribe (email + source)", () => {
    expect(validatePostLeadsBody(subscribe)).toMatchObject({ kind: "subscribe" });
  });

  it("accepts and preserves the audit qualifying fields", () => {
    const result = validatePostLeadsBody({
      ...subscribe,
      name: "Ada Lovelace",
      company: "Test Co",
      audit_answers: { role: "label-owner", budget: "5k-15k" },
      audit_score: "Ready to Scale",
    });
    expect(result).toMatchObject({
      audit_answers: { role: "label-owner", budget: "5k-15k" },
      audit_score: "Ready to Scale",
    });
  });

  it("accepts and preserves the ROI qualifying fields", () => {
    const result = validatePostLeadsBody({
      ...subscribe,
      source: "/roi",
      company: "Test Co",
      roi_inputs: { artists: 15, contentSpend: 5000 },
      roi_results: { yearlySavings: 93012 },
    });
    expect(result).toMatchObject({
      roi_inputs: { artists: 15, contentSpend: 5000 },
      roi_results: { yearlySavings: 93012 },
    });
  });

  it("rejects an unknown kind", () => {
    expect((validatePostLeadsBody({ ...subscribe, kind: "nope" }) as NextResponse).status).toBe(
      400,
    );
  });

  it("rejects a bad email", () => {
    expect((validatePostLeadsBody({ ...subscribe, email: "nope" }) as NextResponse).status).toBe(
      400,
    );
  });

  it("rejects a missing source — an unattributable lead cannot be triaged", () => {
    expect(
      (validatePostLeadsBody({ kind: "subscribe", email: "a@b.com" }) as NextResponse).status,
    ).toBe(400);
  });

  it("rejects a non-object body", () => {
    expect((validatePostLeadsBody("nope") as NextResponse).status).toBe(400);
  });
});
