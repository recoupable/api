import { slackGet } from "./slackGet";

interface UsersInfoResponse {
  ok: boolean;
  error?: string;
  user?: {
    id: string;
    real_name?: string;
    profile?: {
      display_name?: string;
      real_name?: string;
      image_48?: string;
    };
  };
}

/**
 * Get Slack User Info.
 *
 * @param token - Parameter.
 * @param userId - Parameter.
 * @returns - Result.
 */
export async function getSlackUserInfo(
  token: string,
  userId: string,
): Promise<{ name: string; avatar: string | null }> {
  const resp = await slackGet<UsersInfoResponse>("users.info", token, { user: userId });
  if (!resp.ok) {
    return { name: userId, avatar: null };
  }
  const profile = resp.user?.profile;
  return {
    name: profile?.display_name || profile?.real_name || resp.user?.real_name || userId,
    avatar: profile?.image_48 ?? null,
  };
}
