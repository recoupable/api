interface ToolPolicy {
  readOnly: boolean;
  destructive?: boolean;
  notice?: string;
}
/** Explicit inventory: a newly registered tool cannot silently become delegated authority. */
export const fullOAuthToolPolicy: Record<string, ToolPolicy> = {
  list_artists: { readOnly: true },
  get_artist_socials: { readOnly: true },
  artist_deep_research: { readOnly: true },
  spotify_deep_research: { readOnly: true },
  get_spotify_album: { readOnly: true },
  get_spotify_artist_albums: { readOnly: true },
  get_spotify_artist_top_tracks: { readOnly: true },
  get_spotify_search: { readOnly: true },
  get_local_time: { readOnly: true },
  get_chats: { readOnly: true },
  get_pulses: { readOnly: true },
  get_tasks: { readOnly: true },
  get_task_run_status: {
    readOnly: true,
    notice: "Only caller-owned runs with verifiable ownership can be read.",
  },
  select_catalogs: { readOnly: true },
  select_catalog_songs: { readOnly: true },
  get_youtube_revenue: { readOnly: true },
  search_google_images: { readOnly: true },
  search_web: { readOnly: true },
  web_deep_research: { readOnly: true },
  retrieve_sora_2_video: {
    readOnly: true,
    notice:
      "Pass the account-bound video_id returned by this OAuth connection's generate_sora_2_video call.",
  },
  retrieve_sora_2_video_content: {
    readOnly: true,
    notice: "Pass the account-bound video_id returned by generate_sora_2_video.",
  },
  list_sites: { readOnly: true },
  get_site: { readOnly: true },
  get_site_signups: { readOnly: true },
  get_site_generation: { readOnly: true },
  create_new_artist: { readOnly: false, destructive: false },
  update_account_info: { readOnly: false },
  update_artist_socials: { readOnly: false },
  update_pulse: { readOnly: false },
  create_task: { readOnly: false, destructive: false },
  update_task: { readOnly: false },
  delete_task: { readOnly: false },
  insert_catalog_songs: { readOnly: false, destructive: false },
  compact_chats: { readOnly: false },
  // Context operations are classified individually in contextToolOperations.ts.
  generate_image: { readOnly: false, destructive: false },
  edit_image: { readOnly: false, destructive: false },
  generate_sora_2_video: { readOnly: false, destructive: false },
  analyze_music: { readOnly: false, destructive: false },
  transcribe_audio: { readOnly: false, destructive: false },
  create_knowledge_base: {
    readOnly: false,
    destructive: true,
    notice:
      "Publishes text permanently to public Arweave. Use only for content explicitly approved for permanent public publication; never confidential material.",
  },
  generate_txt_file: {
    readOnly: false,
    destructive: true,
    notice:
      "Publishes text permanently to public Arweave. Use only for content explicitly approved for permanent public publication; never confidential material.",
  },
  contact_team: {
    readOnly: false,
    destructive: false,
    notice: "Sends a message to Recoup support. Requires an explicit request to contact support.",
  },
  send_email: {
    readOnly: false,
    destructive: false,
    notice:
      "Sends email immediately. Confirm exact recipients and content with the account before calling. Existing recipient restrictions apply.",
  },
  upload_site_asset: { readOnly: false, destructive: false },
  create_site: { readOnly: false, destructive: false },
  propose_site_concepts: { readOnly: false, destructive: false },
  generate_site: { readOnly: false, destructive: false },
  publish_site: { readOnly: false },
  unpublish_site: { readOnly: false },
  delete_site: { readOnly: false },
};
