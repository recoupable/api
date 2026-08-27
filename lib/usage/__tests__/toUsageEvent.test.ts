import { describe, it, expect } from "vitest";
import { toUsageEvent } from "@/lib/usage/toUsageEvent";
import type { Tables } from "@/types/database.types";

const row: Tables<"usage_events"> = {
  id: "3AANn3Ij9uF-zZIlW_zlP",
  account_id: "123e4567-e89b-12d3-a456-426614174000",
  source: "api",
  agent_type: "main",
  provider: "fal",
  model_id: "minimax/music-3",
  input_tokens: 0,
  cached_input_tokens: 0,
  output_tokens: 0,
  tool_call_count: 0,
  created_at: "2026-08-27T11:56:58.000+00:00",
  credits_deducted: 20000,
};

describe("toUsageEvent", () => {
  it("maps the row to the documented item, naming the charge credits_deducted", () => {
    expect(toUsageEvent(row)).toEqual({
      id: "3AANn3Ij9uF-zZIlW_zlP",
      created_at: "2026-08-27T11:56:58.000Z",
      source: "api",
      agent_type: "main",
      provider: "fal",
      model_id: "minimax/music-3",
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      tool_call_count: 0,
      credits_deducted: 20000,
      usd: "$0.02",
    });
    expect(toUsageEvent(row)).not.toHaveProperty("credits_deducted");
  });

  it("formats a sub-cent charge as $0.00 and keeps the exact integer", () => {
    const item = toUsageEvent({ ...row, credits_deducted: 2000 });
    expect(item.credits_deducted).toBe(2000);
    expect(item.usd).toBe("$0.00");
  });
});
