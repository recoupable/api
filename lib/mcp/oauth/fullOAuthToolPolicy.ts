interface ToolPolicy {
  readOnly: boolean;
  destructive: boolean;
  openWorld: boolean;
  notice?: string;
}
/** Explicit inventory: a newly registered tool cannot silently become delegated authority. */
export const fullOAuthToolPolicy: Record<string, ToolPolicy> = {
  prepare_release_pack: { readOnly: false, destructive: true, openWorld: false },
  get_release_pack: {
    readOnly: false,
    destructive: true,
    openWorld: false,
    notice:
      "Reading an expired running pack settles its unfinished work, updates job and asset status, and refunds held credits.",
  },
  estimate_release_pack: { readOnly: false, destructive: true, openWorld: true },
  generate_release_pack: {
    readOnly: false,
    destructive: true,
    openWorld: false,
    notice: "Requires explicit approval of the complete current quote and budget. Never publishes.",
  },
  retry_release_pack: {
    readOnly: false,
    destructive: true,
    openWorld: false,
    notice:
      "Paid retries require a fresh approved targeted quote; accepted work resumes without duplicate submission.",
  },
  upload_release_pack_asset: { readOnly: false, destructive: false, openWorld: true },
  export_release_pack: {
    readOnly: false,
    destructive: true,
    openWorld: false,
    notice:
      "Updates the saved export timestamp. An expired running pack may also settle unfinished work and refund held credits.",
  },
  list_artists: { readOnly: true, destructive: false, openWorld: false },
  get_artist_socials: { readOnly: true, destructive: false, openWorld: false },
  artist_deep_research: { readOnly: true, destructive: false, openWorld: false },
  spotify_deep_research: { readOnly: true, destructive: false, openWorld: false },
  get_spotify_album: { readOnly: true, destructive: false, openWorld: true },
  get_spotify_artist_albums: { readOnly: true, destructive: false, openWorld: true },
  get_spotify_artist_top_tracks: { readOnly: true, destructive: false, openWorld: true },
  get_spotify_search: { readOnly: true, destructive: false, openWorld: true },
  get_local_time: { readOnly: true, destructive: false, openWorld: false },
  get_chats: { readOnly: true, destructive: false, openWorld: false },
  get_pulses: { readOnly: true, destructive: false, openWorld: false },
  get_tasks: { readOnly: true, destructive: false, openWorld: false },
  get_task_run_status: {
    readOnly: true,
    destructive: false,
    openWorld: false,
    notice: "Only caller-owned runs with verifiable ownership can be read.",
  },
  select_catalogs: { readOnly: true, destructive: false, openWorld: false },
  select_catalog_songs: { readOnly: true, destructive: false, openWorld: false },
  get_youtube_revenue: { readOnly: true, destructive: false, openWorld: false },
  search_google_images: { readOnly: true, destructive: false, openWorld: true },
  search_web: { readOnly: true, destructive: false, openWorld: true },
  web_deep_research: { readOnly: true, destructive: false, openWorld: true },
  retrieve_sora_2_video: {
    readOnly: true,
    destructive: false,
    openWorld: false,
    notice:
      "Pass the account-bound video_id returned by this OAuth connection's generate_sora_2_video call.",
  },
  retrieve_sora_2_video_content: {
    readOnly: true,
    destructive: false,
    openWorld: false,
    notice: "Pass the account-bound video_id returned by generate_sora_2_video.",
  },
  list_release_player: { readOnly: true, destructive: false, openWorld: false },
  get_release_player: { readOnly: true, destructive: false, openWorld: false },
  get_release_player_activity: {
    readOnly: true,
    destructive: false,
    openWorld: false,
    notice: "Private reported browser listening; never DSP stream totals.",
  },
  get_release_player_fans: {
    readOnly: true,
    destructive: false,
    openWorld: false,
    notice: "Private artist/workspace fan profiles. Sign-in is not marketing consent.",
  },
  get_workspace_player_fans: {
    readOnly: true,
    destructive: false,
    openWorld: false,
    notice:
      "Private workspace fan contacts with artist relationships. Sign-in is not marketing consent.",
  },
  create_release_player: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice:
      "Disabled by default. Setting enabled=true publishes; requires explicit account authorization.",
  },
  update_release_player: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice: "Enabling publishes. Require explicit account authorization and current revision.",
  },
  list_sites: { readOnly: true, destructive: false, openWorld: false },
  get_site: { readOnly: true, destructive: false, openWorld: false },
  get_site_signups: { readOnly: true, destructive: false, openWorld: false },
  get_site_generation: { readOnly: true, destructive: false, openWorld: false },
  create_new_artist: { readOnly: false, destructive: false, openWorld: false },
  update_account_info: { readOnly: false, destructive: true, openWorld: false },
  update_artist_socials: { readOnly: false, destructive: true, openWorld: false },
  update_pulse: { readOnly: false, destructive: true, openWorld: false },
  create_task: { readOnly: false, destructive: false, openWorld: false },
  update_task: { readOnly: false, destructive: true, openWorld: false },
  delete_task: { readOnly: false, destructive: true, openWorld: false },
  insert_catalog_songs: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice:
      "May enrich songs using public Spotify data and overwrite existing shared song metadata for matching ISRCs.",
  },
  compact_chats: {
    readOnly: true,
    destructive: false,
    openWorld: false,
    notice: "Returns a summary without saving it or replacing the source conversation.",
  },
  // Context operations are classified individually in contextToolOperations.ts.
  generate_image: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice:
      "Generates a new image and uploads it to public media storage; use only when public storage is authorized.",
  },
  edit_image: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice:
      "Creates a new edited image and uploads it to public media storage; the source image is retained. Use only when public storage is authorized.",
  },
  generate_sora_2_video: { readOnly: false, destructive: false, openWorld: false },
  analyze_music: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice: "Successful analysis deducts Recoup credits from the connected account.",
  },
  transcribe_audio: { readOnly: false, destructive: false, openWorld: true },
  create_knowledge_base: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice:
      "Publishes text to public media storage. Use only for content explicitly approved for public publication; never confidential material.",
  },
  generate_txt_file: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice:
      "Publishes text to public media storage. Use only for content explicitly approved for public publication; never confidential material.",
  },
  contact_team: {
    readOnly: false,
    destructive: true,
    openWorld: false,
    notice: "Sends a message to Recoup support. Requires an explicit request to contact support.",
  },
  send_email: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice:
      "Sends email immediately. Confirm exact recipients and content with the account before calling. Existing recipient restrictions apply.",
  },
  upload_site_asset: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice:
      "Uploads bytes to public site asset storage. Anyone with the returned URL can access them.",
  },
  create_site: { readOnly: false, destructive: false, openWorld: true },
  propose_site_concepts: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice: "Collects public release context and incurs generation credit usage.",
  },
  generate_site: {
    readOnly: false,
    destructive: true,
    openWorld: true,
    notice: "Runs generation and replaces the saved draft; generation incurs credit usage.",
  },
  publish_site: { readOnly: false, destructive: true, openWorld: true },
  unpublish_site: { readOnly: false, destructive: true, openWorld: true },
  delete_site: { readOnly: false, destructive: true, openWorld: true },
};
