import { z } from "zod";

export const packAudioAnalysisTextSchema = z.string().refine(
  value =>
    // Match Context evidence substance without rewriting Unicode claims.
    /[^\s\p{Cf}\p{Default_Ignorable_Code_Point}]/u.test(value) &&
    !/^(?:n\/a|none|unknown|unavailable|not available|not applicable)$/i.test(value.trim()),
  "Audio analysis must contain descriptive observations and direction, not placeholder text",
);
