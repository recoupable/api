import type { ModelMessage } from "ai";
import type { Site, SiteSnapshot } from "../schema";
export type SiteBuildState = {
  site: Site;
  instruction: string;
  brandWorld: NonNullable<SiteSnapshot["brandWorld"]>;
  files: { html: string; css: string; javascript: string };
  notes: string;
  visualMechanismReads?: { sourceHash: string; patternIds: string[] }[];
  messages: ModelMessage[];
  inputTokens: number;
  turns: number;
  compactions: number;
  snapshot?: SiteSnapshot;
};
