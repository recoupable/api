type TweetFlags = { isRetweet?: boolean; isQuote?: boolean; isReply?: boolean };

/**
 * True for tweets the artist actually authored — originals and quote tweets
 * (their own words on top). Retweets are someone else's content and carry the
 * ORIGINAL author's engagement stats, so persisting or reporting them
 * misattributes both (chat#1855 feedback: an all-retweet digest section
 * showed "hundreds of likes" the artist never earned). Replies are excluded
 * as conversational noise rather than roster posts. Items without flags pass
 * (defensive default — never silently drop a scrape result on schema drift).
 */
export function isOriginalTweet(item: TweetFlags): boolean {
  return !item.isRetweet && !item.isReply;
}
