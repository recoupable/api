import { LanguageModel, ModelMessage } from "ai";
import { createReleaseReportToolChain } from "./create_release_report/createReleaseReportToolChain";
import { createNewArtistToolChain } from "./createNewArtistToolChain";

export type ToolChainItem = {
  toolName: string;
  system?: string;
  messages?: ModelMessage[];
};

export type PrepareStepResult = {
  toolChoice?: { type: "tool"; toolName: string };
  model?: LanguageModel;
  system?: string;
  messages?: ModelMessage[];
};

// Forced toolChoice is incompatible with Anthropic extended thinking.
// Every tool used in a chain must have a model here to avoid the conflict.
export const TOOL_MODEL_MAP: Record<string, LanguageModel> = {
  update_account_info: "gemini-2.5-pro",
  get_spotify_search: "openai/gpt-5.4-mini",
  update_artist_socials: "openai/gpt-5.4-mini",
  artist_deep_research: "openai/gpt-5.4-mini",
  spotify_deep_research: "openai/gpt-5.4-mini",
  get_artist_socials: "openai/gpt-5.4-mini",
  get_spotify_artist_top_tracks: "openai/gpt-5.4-mini",
  get_spotify_artist_albums: "openai/gpt-5.4-mini",
  get_spotify_album: "openai/gpt-5.4-mini",
  search_web: "openai/gpt-5.4-mini",
  generate_txt_file: "openai/gpt-5.4-mini",
  create_segments: "openai/gpt-5.4-mini",
  youtube_login: "openai/gpt-5.4-mini",
  web_deep_research: "openai/gpt-5.4-mini",
  create_knowledge_base: "openai/gpt-5.4-mini",
  send_email: "openai/gpt-5.4-mini",
};

// Map trigger tool -> sequence AFTER trigger
export const TOOL_CHAINS: Record<string, readonly ToolChainItem[]> = {
  create_new_artist: createNewArtistToolChain,
  create_release_report: createReleaseReportToolChain,
  // You can add other chains here, e.g.:
  // create_campaign: [
  //   { toolName: "fetch_posts" },
  //   { toolName: "analyze_funnel" },
  //   { toolName: "generate_email_copy" },
  //   { toolName: "schedule_campaign" }
  // ],
};
