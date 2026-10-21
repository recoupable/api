import { z } from "zod";
import {
  RESEARCH_AUDIENCE_PLATFORM_SOURCES,
  type ResearchAudiencePlatform,
} from "./researchAudiencePlatforms";

export const researchAudiencePlatformSchema = z.enum(
  Object.keys(RESEARCH_AUDIENCE_PLATFORM_SOURCES) as [
    ResearchAudiencePlatform,
    ...ResearchAudiencePlatform[],
  ],
);
