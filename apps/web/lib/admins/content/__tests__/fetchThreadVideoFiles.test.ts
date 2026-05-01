import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchThreadVideoFiles } from "../fetchThreadVideoFiles";

import { slackGet } from "@/lib/slack/slackGet";

vi.mock("@/lib/slack/slackGet", () => ({
  slackGet: vi.fn(),
}));

describe("fetchThreadVideoFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when Slack API returns not ok", async () => {
    vi.mocked(slackGet).mockResolvedValue({ ok: false });

    const result = await fetchThreadVideoFiles("token", "C123", "1234.5678");
    expect(result).toEqual([]);
  });

  it("returns empty array when no bot messages have files", async () => {
    vi.mocked(slackGet).mockResolvedValue({
      ok: true,
      messages: [
        { type: "message", user: "U1", text: "hello", ts: "1234.5678" },
        { type: "message", bot_id: "B1", text: "reply", ts: "1234.5679" },
      ],
    });

    const result = await fetchThreadVideoFiles("token", "C123", "1234.5678");
    expect(result).toEqual([]);
  });

  it("extracts video permalinks from bot message files", async () => {
    vi.mocked(slackGet).mockResolvedValue({
      ok: true,
      messages: [
        { type: "message", user: "U1", text: "tag", ts: "1234.5678" },
        {
          type: "message",
          bot_id: "B1",
          text: "Video 1",
          ts: "1234.5679",
          files: [
            {
              id: "F1",
              name: "artist.mp4",
              mimetype: "video/mp4",
              permalink: "https://slack.com/files/F1",
            },
          ],
        },
      ],
    });

    const result = await fetchThreadVideoFiles("token", "C123", "1234.5678");
    expect(result).toEqual(["https://slack.com/files/F1"]);
  });

  it("skips the parent message even if it has bot_id", async () => {
    vi.mocked(slackGet).mockResolvedValue({
      ok: true,
      messages: [
        {
          type: "message",
          bot_id: "B1",
          text: "parent",
          ts: "1234.5678",
          files: [
            {
              id: "F1",
              name: "v.mp4",
              mimetype: "video/mp4",
              permalink: "https://slack.com/F1",
            },
          ],
        },
        {
          type: "message",
          bot_id: "B1",
          text: "reply",
          ts: "1234.5679",
          files: [
            {
              id: "F2",
              name: "v2.mp4",
              mimetype: "video/mp4",
              permalink: "https://slack.com/F2",
            },
          ],
        },
      ],
    });

    const result = await fetchThreadVideoFiles("token", "C123", "1234.5678");
    expect(result).toEqual(["https://slack.com/F2"]);
  });

  it("deduplicates video URLs across messages", async () => {
    vi.mocked(slackGet).mockResolvedValue({
      ok: true,
      messages: [
        { type: "message", user: "U1", ts: "1234.5678" },
        {
          type: "message",
          bot_id: "B1",
          ts: "1234.5679",
          files: [{ id: "F1", mimetype: "video/mp4", permalink: "https://slack.com/F1" }],
        },
        {
          type: "message",
          bot_id: "B1",
          ts: "1234.5680",
          files: [{ id: "F1", mimetype: "video/mp4", permalink: "https://slack.com/F1" }],
        },
      ],
    });

    const result = await fetchThreadVideoFiles("token", "C123", "1234.5678");
    expect(result).toEqual(["https://slack.com/F1"]);
  });
});
