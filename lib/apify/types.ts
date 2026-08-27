export interface ApifyRunInfo {
  runId: string;
  datasetId: string;
}

export type ApifyInstagramPost = {
  id: string;
  type: string;
  shortCode: string;
  caption: string;
  hashtags: string[];
  mentions: string[];
  url: string;
  commentsCount: number;
  dimensionsHeight: number;
  dimensionsWidth: number;
  displayUrl: string;
  images: string[];
  alt: string;
  likesCount: number;
  timestamp: string;
  childPosts: ApifyInstagramPost[];
  ownerUsername: string;
  ownerId: string;
  isCommentsDisabled: boolean;
};

export interface ApifyInstagramComment {
  id: string;
  text: string;
  timestamp: string;
  ownerUsername: string;
  ownerProfilePicUrl: string;
  postUrl: string;
}

export interface ApifyInstagramProfileResult {
  latestPosts?: ApifyInstagramPost[];
  profilePicUrlHD?: string;
  profilePicUrl?: string;
  username?: string;
  url?: string;
  biography?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  fullName?: string;
}

/** Why a run was started; decides whether its webhook may schedule follow-ups. */
export type ApifyScrapeOrigin = "artist" | "fan";

/**
 * Lineage stamped into every run's webhook payload (recoupable/app#2018).
 * `origin: "artist"` — a roster artist's profile; the handler may spawn a
 * comments run and one commenter batch. `origin: "fan"` — that commenter
 * batch; terminal by construction. `parentRunId` is the run whose webhook
 * started this one, absent for runs a scrape endpoint started.
 */
export interface ApifyRunLineage {
  origin: ApifyScrapeOrigin;
  parentRunId?: string;
}
