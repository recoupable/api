import { describe, it, expect } from "vitest";
import { extractGithubPrUrls } from "../extractGithubPrUrls";

describe("extractGithubPrUrls", () => {
  it("extracts PR URLs from plain text", () => {
    const text = "Check out https://github.com/recoupable/api/pull/331 for details";
    expect(extractGithubPrUrls(text)).toEqual(["https://github.com/recoupable/api/pull/331"]);
  });

  it("extracts PR URLs from Slack-formatted links", () => {
    const text = "PR: <https://github.com/recoupable/api/pull/42|recoupable/api#42>";
    expect(extractGithubPrUrls(text)).toEqual(["https://github.com/recoupable/api/pull/42"]);
  });

  it("extracts multiple PR URLs and deduplicates", () => {
    const text =
      "https://github.com/recoupable/api/pull/1 and https://github.com/recoupable/docs/pull/2 and https://github.com/recoupable/api/pull/1";
    expect(extractGithubPrUrls(text)).toEqual([
      "https://github.com/recoupable/api/pull/1",
      "https://github.com/recoupable/docs/pull/2",
    ]);
  });

  it("returns empty array when no PR URLs found", () => {
    expect(extractGithubPrUrls("no links here")).toEqual([]);
  });

  it("extracts PR URLs from Slack attachment actions", () => {
    const attachments = [
      {
        actions: [
          {
            type: "button",
            text: "Review recoupable/admin#21",
            url: "https://github.com/recoupable/admin/pull/21",
          },
          {
            type: "button",
            text: "Merge recoupable/admin#21",
            url: "https://github.com/recoupable/admin/pull/21",
          },
        ],
      },
    ];
    expect(extractGithubPrUrls("", attachments)).toEqual([
      "https://github.com/recoupable/admin/pull/21",
    ]);
  });

  it("extracts PR URLs from both text and attachments", () => {
    const text = "PR opened: https://github.com/recoupable/api/pull/10";
    const attachments = [
      {
        actions: [
          { type: "button", text: "Review", url: "https://github.com/recoupable/admin/pull/21" },
        ],
      },
    ];
    expect(extractGithubPrUrls(text, attachments)).toEqual([
      "https://github.com/recoupable/api/pull/10",
      "https://github.com/recoupable/admin/pull/21",
    ]);
  });

  it("ignores non-PR GitHub URLs in attachments", () => {
    const attachments = [
      {
        actions: [
          { type: "button", text: "View", url: "https://github.com/recoupable/api/issues/5" },
        ],
      },
    ];
    expect(extractGithubPrUrls("", attachments)).toEqual([]);
  });

  it("extracts PR URLs from Block Kit blocks", () => {
    const blocks = [
      {
        type: "actions",
        elements: [
          { type: "button", url: "https://github.com/recoupable/admin/pull/21" },
          { type: "button", url: "https://github.com/recoupable/admin/pull/21" },
        ],
      },
    ];
    expect(extractGithubPrUrls("", undefined, blocks)).toEqual([
      "https://github.com/recoupable/admin/pull/21",
    ]);
  });

  it("extracts PR URLs from nested block elements", () => {
    const blocks = [
      {
        type: "rich_text",
        elements: [
          {
            type: "rich_text_section",
            elements: [{ type: "link", url: "https://github.com/recoupable/api/pull/332" }],
          },
        ],
      },
    ];
    expect(extractGithubPrUrls("", undefined, blocks)).toEqual([
      "https://github.com/recoupable/api/pull/332",
    ]);
  });

  it("extracts PR URLs from text, attachments, and blocks combined", () => {
    const text = "See https://github.com/recoupable/docs/pull/75";
    const attachments = [
      {
        actions: [{ type: "button", url: "https://github.com/recoupable/api/pull/332" }],
      },
    ];
    const blocks = [
      {
        type: "actions",
        elements: [{ type: "button", url: "https://github.com/recoupable/admin/pull/21" }],
      },
    ];
    expect(extractGithubPrUrls(text, attachments, blocks)).toEqual([
      "https://github.com/recoupable/docs/pull/75",
      "https://github.com/recoupable/api/pull/332",
      "https://github.com/recoupable/admin/pull/21",
    ]);
  });
});
