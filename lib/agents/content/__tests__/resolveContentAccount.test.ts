import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsoleLogger } from "chat";
import { SlackAdapter } from "@chat-adapter/slack";
import { resolveContentAccount } from "../resolveContentAccount";

describe("content account identity with the installed Slack adapter", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([{ team: "T123" }, { team_id: "T123" }, { team: "T123", team_id: "T123" }])(
    "accepts the signed SDK workspace fields: %j",
    workspace => {
      const accountId = "10000000-0000-4000-8000-000000000001";
      vi.stubEnv("SLACK_CONTENT_ACCOUNT_BINDINGS", JSON.stringify({ "T123:U123": accountId }));
      const adapter = new SlackAdapter({
        botToken: "xoxb-test",
        signingSecret: "test",
        logger: new ConsoleLogger("silent"),
      });
      const message = adapter.parseMessage({
        type: "app_mention",
        ...workspace,
        user: "U123",
        channel: "C123",
        ts: "1.2",
        text: "Generate for North Star",
      });
      expect(resolveContentAccount(message)).toBe(accountId);
    },
  );

  it("rejects conflicting workspace identity instead of choosing one", () => {
    vi.stubEnv(
      "SLACK_CONTENT_ACCOUNT_BINDINGS",
      '{"T123:U123":"10000000-0000-4000-8000-000000000001"}',
    );
    const adapter = new SlackAdapter({
      botToken: "xoxb-test",
      signingSecret: "test",
      logger: new ConsoleLogger("silent"),
    });
    const message = adapter.parseMessage({
      type: "app_mention",
      team: "T999",
      team_id: "T123",
      user: "U123",
      channel: "C123",
      ts: "1.2",
      text: "Generate",
    });
    expect(resolveContentAccount(message)).toBeNull();
  });
});
