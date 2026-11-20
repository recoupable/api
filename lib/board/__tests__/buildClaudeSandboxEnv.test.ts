import { describe, it, expect } from "vitest";

import { buildClaudeSandboxEnv } from "@/lib/board/buildClaudeSandboxEnv";

describe("buildClaudeSandboxEnv", () => {
  const boardEnv = { BOARD_URL: "https://api.vercel.com/board", BOARD_TOKEN: "placeholder" };

  it("keeps the board's placeholder env", () => {
    expect(buildClaudeSandboxEnv(boardEnv)).toMatchObject(boardEnv);
  });

  it("points Claude Code at AI Gateway with only a placeholder token", () => {
    const env = buildClaudeSandboxEnv(boardEnv);
    expect(env.ANTHROPIC_BASE_URL).toBe("https://ai-gateway.vercel.sh");
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe("brokered-by-sandbox-proxy");
    expect(env.ANTHROPIC_API_KEY).toBe("");
    expect(env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe("1");
  });
});
