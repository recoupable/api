import { describe, it, expect } from "vitest";
import { buildLeadNote } from "@/lib/leads/buildLeadNote";

describe("buildLeadNote", () => {
  it("formats a booking as the Advisory Inquiry note the CRM is searched by", () => {
    const note = buildLeadNote({
      kind: "booking",
      email: "ada@example.com",
      source: "/advisory/book",
      name: "Ada Lovelace",
      company: "Test Co",
      package: "strategy-session",
      role: "Label Owner / GM",
      rosterSize: "21-50 artists",
      message: "hello",
    });
    expect(note?.title).toBe("Advisory Inquiry: Strategy Session ($2,500)");
    expect(note?.content).toContain("Package: Strategy Session ($2,500)");
    expect(note?.content).toContain("Company: Test Co");
    expect(note?.content).toContain("Role: Label Owner / GM");
    expect(note?.content).toContain("Roster Size: 21-50 artists");
    expect(note?.content).toContain("Message: hello");
    expect(note?.content).toContain("Source: /advisory/book");
  });

  it("falls back to the raw package slug when the label is unknown", () => {
    const note = buildLeadNote({
      kind: "booking",
      email: "a@b.com",
      source: "/advisory/book",
      name: "Ada",
      package: "mystery-tier",
    });
    expect(note?.title).toBe("Advisory Inquiry: mystery-tier");
  });

  it("formats a completed audit with score, answers and company", () => {
    const note = buildLeadNote({
      kind: "subscribe",
      email: "ada@example.com",
      source: "/audit",
      company: "Test Co",
      audit_score: "Ready to Scale",
      audit_answers: { role: "label-owner", budget: "5k-15k" },
    });
    expect(note?.title).toBe("AI Readiness Audit: Ready to Scale");
    expect(note?.content).toContain("Company: Test Co");
    expect(note?.content).toContain("role: label-owner");
    expect(note?.content).toContain("budget: 5k-15k");
  });

  it("formats an ROI submission with inputs and results", () => {
    const note = buildLeadNote({
      kind: "subscribe",
      email: "ada@example.com",
      source: "/roi",
      company: "Test Co",
      roi_inputs: { artists: 15 },
      roi_results: { yearlySavings: 93012 },
    });
    expect(note?.title).toBe("ROI Calculator");
    expect(note?.content).toContain("Company: Test Co");
    expect(note?.content).toContain("artists: 15");
    expect(note?.content).toContain("yearlySavings: 93012");
  });

  it("retains the source of a plain signup without inventing attribution", () => {
    const note = buildLeadNote({ kind: "subscribe", email: "a@b.com", source: "/blog" });
    expect(note).toEqual({ title: "Website Signup", content: "Source: /blog" });
  });

  it.each([
    { source: "/podcast" },
    { source: "/audit", audit_score: 0, audit_answers: { role: "label-owner" } },
    { source: "/roi", roi_inputs: { artists: 15 }, roi_results: { yearlySavings: 100 } },
  ])("preserves campaign attribution on $source submissions", payload => {
    const note = buildLeadNote({
      kind: "subscribe",
      email: "a@b.com",
      company: "Example Music",
      ...payload,
      utm_source: "linkedin",
      utm_medium: "social",
      utm_campaign: "music-ops",
      source_post_slug: "catalog-reporting",
    });
    expect(note?.content).toContain(`Source: ${payload.source}`);
    expect(note?.content).toContain("Company: Example Music");
    expect(note?.content).toContain("UTM source: linkedin");
    expect(note?.content).toContain("UTM medium: social");
    expect(note?.content).toContain("UTM campaign: music-ops");
    expect(note?.content).toContain("Source post: catalog-reporting");
  });
});
