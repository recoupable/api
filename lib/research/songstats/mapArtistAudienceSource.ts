import {
  RESEARCH_AUDIENCE_PLATFORM_SOURCES,
  type ResearchAudiencePlatform,
} from "../researchAudiencePlatforms";

/** Maps known audience aliases while leaving other internal source names unchanged. */
export function mapArtistAudienceSource(source: string): string {
  return Object.hasOwn(RESEARCH_AUDIENCE_PLATFORM_SOURCES, source)
    ? RESEARCH_AUDIENCE_PLATFORM_SOURCES[source as ResearchAudiencePlatform]
    : source;
}
