export interface SocialPostResponse {
  id: string;
  post_id: string | null;
  social_id: string | null;
  post_url: string | null;
  updated_at: string | null;
}

// Supabase generated types infer the `post:posts(...)` embed as an array even
// though the FK is one-to-one, so narrow it at runtime before flattening.
type SocialPostRow = {
  id: string;
  post_id: string | null;
  social_id: string | null;
  updated_at: string | null;
  post:
    | { id: string; post_url: string | null; updated_at: string | null }
    | { id: string; post_url: string | null; updated_at: string | null }[]
    | null;
};

export function flattenSocialPosts(rows: SocialPostRow[]): SocialPostResponse[] {
  return rows.map(row => {
    const post = Array.isArray(row.post) ? row.post[0] : row.post;
    return {
      id: row.id,
      post_id: row.post_id,
      social_id: row.social_id,
      post_url: post?.post_url ?? null,
      updated_at: row.updated_at,
    };
  });
}
