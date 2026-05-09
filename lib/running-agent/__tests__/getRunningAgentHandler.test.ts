import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/supabase/accounts/selectAccount", () => ({
  selectAccount: vi.fn(),
}));

vi.mock("@/lib/supabase/agent_status/selectRunningAgentStatus", () => ({
  selectRunningAgentStatus: vi.fn(),
}));

import { selectAccount } from "@/lib/supabase/accounts/selectAccount";
import { selectRunningAgentStatus } from "@/lib/supabase/agent_status/selectRunningAgentStatus";
import { getRunningAgentHandler } from "../getRunningAgentHandler";

describe("getRunningAgentHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when artistId is missing", async () => {
    const result = await getRunningAgentHandler({ artistId: "" });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("returns null agent when account not found", async () => {
    vi.mocked(selectAccount).mockResolvedValue(null);

    const result = await getRunningAgentHandler({ artistId: "art-1" });

    expect(selectAccount).toHaveBeenCalledWith("art-1");
    expect(result).toBeInstanceOf(NextResponse);
    const json = await (result as NextResponse).json();
    expect(json).toEqual({ agent: null });
    expect((result as NextResponse).status).toBe(200);
  });

  it("returns running agent status on success", async () => {
    vi.mocked(selectAccount).mockResolvedValue({
      id: "art-1",
      account_socials: [{ social_id: "s1" }, { social_id: "s2" }],
    } as any);
    const mockAgent = { id: "ag-1", status: "PROFILE", social_id: "s1" };
    vi.mocked(selectRunningAgentStatus).mockResolvedValue(mockAgent as any);

    const result = await getRunningAgentHandler({ artistId: "art-1" });

    expect(selectRunningAgentStatus).toHaveBeenCalledWith(["s1", "s2"]);
    expect(result).toBeInstanceOf(NextResponse);
    const json = await (result as NextResponse).json();
    expect(json).toEqual({ agent: mockAgent });
    expect((result as NextResponse).status).toBe(200);
  });

  it("returns null agent when no running agent found", async () => {
    vi.mocked(selectAccount).mockResolvedValue({
      id: "art-1",
      account_socials: [{ social_id: "s1" }],
    } as any);
    vi.mocked(selectRunningAgentStatus).mockResolvedValue(null);

    const result = await getRunningAgentHandler({ artistId: "art-1" });

    expect(result).toBeInstanceOf(NextResponse);
    const json = await (result as NextResponse).json();
    expect(json).toEqual({ agent: null });
  });

  it("returns 400 on unexpected error", async () => {
    vi.mocked(selectAccount).mockRejectedValue(new Error("db error"));

    const result = await getRunningAgentHandler({ artistId: "art-1" });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
    const json = await (result as NextResponse).json();
    expect(json.message).toBe("db error");
  });
});
