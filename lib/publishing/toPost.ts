import type { Tables } from "@/types/database.types";

/**
 * The public `Post` shape (contract: recoupable/docs#375). Internal handles
 * (`workflow_run_id`, `created_by_account_id`) stay out of the response.
 *
 * @param row - A scheduled_posts row.
 * @returns The post as documented.
 */
export function toPost(row: Tables<"scheduled_posts">) {
  return {
    id: row.id,
    account_id: row.account_id,
    artist_account_id: row.artist_account_id,
    platform: row.platform,
    sub_account_id: row.sub_account_id,
    status: row.status,
    video_url: row.video_url,
    cover_url: row.cover_url,
    title: row.title,
    description: row.description,
    privacy: row.privacy,
    tags: row.tags,
    publish_at: row.publish_at,
    post_url: row.post_url,
    error_message: row.error_message,
    text_verified: row.text_verified,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
