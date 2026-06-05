import {
  RESEARCH_AUDIENCE_PLATFORM_SOURCES,
  type ResearchAudiencePlatform,
} from "@/lib/research/researchAudiencePlatforms";

/**
 * Maps a legacy audience platform to its SongStats audience metric source.
 */
export function mapArtistAudienceSource(source: string): string {
  if (Object.hasOwn(RESEARCH_AUDIENCE_PLATFORM_SOURCES, source)) {
    return RESEARCH_AUDIENCE_PLATFORM_SOURCES[source as ResearchAudiencePlatform];
  }

  return source;
}
