import type { Tables } from "@/types/database.types";
import type { PostActionTarget } from "@/lib/publishing/executePostAction";

export type PublishInput = {
  target: PostActionTarget;
  post: Tables<"scheduled_posts">;
};

export type PublishResult = {
  postUrl: string;
  /** Whether the live text, re-read after posting, equals the submitted copy. */
  textVerified: boolean;
};
