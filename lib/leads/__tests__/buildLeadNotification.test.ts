import { describe, it, expect } from "vitest";
import { buildLeadNotification } from "@/lib/leads/buildLeadNotification";

const lead = {
  email: "ada@example.com",
  source: "/advisory/book",
  name: "Ada Lovelace",
  company: "Test Co",
  role: "Label Owner / GM",
  package: "Retained Advisor ($5,000/mo)",
  rosterSize: "21-50 artists",
};

describe("buildLeadNotification", () => {
  // #1800's acceptance criterion: the message must carry package, company and role.
  it("carries package, company and role so the lead can be triaged from Telegram", () => {
    const text = buildLeadNotification(lead);
    expect(text).toContain("Package: Retained Advisor ($5,000/mo)");
    expect(text).toContain("Company: Test Co");
    expect(text).toContain("Role: Label Owner / GM");
  });

  it("leads with the source so /advisory/book is distinguishable from /audit", () => {
    expect(buildLeadNotification(lead).split("\n")[0]).toContain("/advisory/book");
  });

  it("includes the name and email together", () => {
    expect(buildLeadNotification(lead)).toContain("Ada Lovelace <ada@example.com>");
  });

  it("falls back to the bare email when no name was supplied", () => {
    const text = buildLeadNotification({ email: "ada@example.com", source: "/audit" });
    expect(text).toContain("ada@example.com");
    expect(text).not.toContain("<");
  });

  it("omits absent optional fields rather than printing blanks", () => {
    const text = buildLeadNotification({ email: "ada@example.com", source: "/audit" });
    expect(text).not.toContain("Company:");
    expect(text).not.toContain("Role:");
    expect(text).not.toContain("undefined");
  });

  it("includes the free-text message when one was supplied", () => {
    const text = buildLeadNotification({ ...lead, message: "We manage 30 artists" });
    expect(text).toContain("We manage 30 artists");
  });
});
