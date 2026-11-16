/** The existing limited grant contract; unknown tools never imply a scope upgrade. */
export const limitedOAuthToolScopes = {
  list_artists: "mcp:read",
  create_new_artist: "mcp:write",
  update_account_info: "mcp:write",
  get_artist_socials: "mcp:read",
  get_chats: "mcp:read",
} as const;
