import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database.types";
import { getAgentSignups } from "../getAgentSignups";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/lib/supabase/serverClient", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    default: createClient<Database>("https://fixture.supabase.test", "fixture-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchMock },
    }),
  };
});

const record = {
  id: "record-1",
  name: "Agent key",
  created_at: "2026-10-21T12:00:00Z",
  accounts: { account_emails: [{ email: "agent+fixture@example.com" }] },
};
function reply(data: unknown, status = 200) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }),
  );
}

describe("getAgentSignups with the installed PostgREST request builder and mocked transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reply([record]);
  });

  it("projects metadata only with inner email filtering and descending key creation date", async () => {
    expect(await getAgentSignups()).toEqual([
      {
        id: record.id,
        name: record.name,
        email: "agent+fixture@example.com",
        created_at: record.created_at,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/rest/v1/account_api_keys");
    expect(url.searchParams.get("select")).toBe(
      "id,name,created_at,accounts!inner(account_emails!inner(email))",
    );
    expect(url.searchParams.get("accounts.account_emails.email")).toBe("ilike.agent+%");
    expect(url.searchParams.get("order")).toBe("created_at.desc");
    expect(url.searchParams.has("created_at")).toBe(false);
    expect(url.search).not.toContain("key_hash");
  });

  it("applies the inclusive creation-time cutoff", async () => {
    await getAgentSignups("2026-10-21T00:00:00.000Z");
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("created_at")).toBe("gte.2026-10-21T00:00:00.000Z");
  });

  it("uses a matching email even if a different email is first; handles uppercase prefixes", async () => {
    reply([
      {
        ...record,
        key_hash: "must-never-leave-fixture",
        accounts: {
          account_emails: [
            { email: "normal@example.com" },
            { email: null },
            { email: "AGENT+UPPER@example.com" },
          ],
        },
      },
    ]);
    expect(await getAgentSignups()).toEqual([
      {
        id: record.id,
        name: record.name,
        created_at: record.created_at,
        email: "AGENT+UPPER@example.com",
      },
    ]);
  });

  it("does not multiply records when more than one matching email exists", async () => {
    reply([
      {
        ...record,
        accounts: {
          account_emails: [
            { email: "agent+first@example.com" },
            { email: "agent+second@example.com" },
          ],
        },
      },
    ]);
    expect(await getAgentSignups()).toHaveLength(1);
  });

  it("retains separate key records for the same account email", async () => {
    reply([record, { ...record, id: "record-2" }]);
    expect((await getAgentSignups()).map(row => row.id)).toEqual(["record-1", "record-2"]);
  });

  it("returns an empty list for a successful empty query", async () => {
    reply([]);
    expect(await getAgentSignups()).toEqual([]);
  });

  it("throws on a database error rather than reporting no records", async () => {
    reply({ code: "42501", message: "fixture denied", details: null, hint: null }, 403);
    await expect(getAgentSignups()).rejects.toThrow("Failed to retrieve agent signup metadata");
  });
});
