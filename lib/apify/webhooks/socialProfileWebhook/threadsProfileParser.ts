import type { SocialProfileParser, SocialProfileParserResult } from "./types";
import type { TablesInsert } from "@/types/database.types";

type ThreadsHdProfilePicVersion = {
  url?: string | null;
} | null;

type ThreadsDatasetItem = {
  username?: string | null;
  biography?: string | null;
  url?: string | null;
  profile_pic_url?: string | null;
  hd_profile_pic_versions?: ThreadsHdProfilePicVersion[] | null;
  follower_count?: number | null;
} | null;

export const threadsProfileParser: SocialProfileParser = (
  datasetItem: unknown,
): SocialProfileParserResult => {
  const item = (datasetItem ?? null) as ThreadsDatasetItem;

  if (!item) {
    return { payload: null };
  }

  const rawHdAvatar = item.hd_profile_pic_versions?.[0]?.url ?? null;

  const payload: TablesInsert<"socials"> = {
    username: item.username ?? "",
    bio: item.biography ?? null,
    profile_url: item.url ?? "",
    avatar: rawHdAvatar ?? item.profile_pic_url ?? null,
    followerCount: item.follower_count ?? null,
    followingCount: null,
  };

  if (!payload.username || !payload.profile_url) {
    return { payload: null };
  }

  return { payload };
};
