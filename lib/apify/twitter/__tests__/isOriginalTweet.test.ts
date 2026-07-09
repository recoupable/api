import { describe, it, expect } from "vitest";
import { isOriginalTweet } from "@/lib/apify/twitter/isOriginalTweet";

describe("isOriginalTweet", () => {
  it("keeps original tweets", () => {
    expect(isOriginalTweet({ isRetweet: false, isQuote: false, isReply: false })).toBe(true);
  });
  it("keeps quote tweets — the artist adds their own words and earns the stats", () => {
    expect(isOriginalTweet({ isRetweet: false, isQuote: true, isReply: false })).toBe(true);
  });
  it("drops retweets — the content and metrics belong to someone else", () => {
    expect(isOriginalTweet({ isRetweet: true, isQuote: false, isReply: false })).toBe(false);
  });
  it("drops replies — conversational noise, not roster posts", () => {
    expect(isOriginalTweet({ isRetweet: false, isQuote: false, isReply: true })).toBe(false);
  });
  it("keeps items without flags (defensive default)", () => {
    expect(isOriginalTweet({})).toBe(true);
  });
});
