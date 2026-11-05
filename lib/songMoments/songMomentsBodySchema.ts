import { z } from "zod";

/** The moments a song can have; not every song has every one. */
export const SONG_MOMENT_TYPES = [
  "intro",
  "vocal_hook",
  "chorus_lift",
  "build_up",
  "climax",
  "breakdown",
  "outro",
] as const;

export type SongMomentType = (typeof SONG_MOMENT_TYPES)[number];

/**
 * Zod schema for the POST /api/songs/moments body.
 *
 * `section_order` is optional: the song's section headers in order, as a lyric
 * sheet lists them ("Verse 1", "Chorus", "Bridge"...). With it, sections are
 * named from the sheet; without it, from repetition and loudness.
 * `describe` chooses which moments Music Flamingo listens to and describes:
 * `true` (default) for all of them, `false` for none, or a list of types.
 */
export const songMomentsBodySchema = z.object({
  audio_url: z
    .string({
      error: issue => (issue.input === undefined ? "audio_url is required" : undefined),
    })
    .url("audio_url must be a valid URL"),
  section_order: z
    .array(
      z
        .string()
        .min(1, "section labels cannot be empty")
        .max(40, "section labels are at most 40 characters"),
    )
    .max(60, "section_order has at most 60 labels")
    .optional(),
  describe: z
    .union([z.boolean(), z.array(z.enum(SONG_MOMENT_TYPES)).max(SONG_MOMENT_TYPES.length)])
    .optional()
    .default(true),
});

/** Inferred TypeScript type from the Zod schema. */
export type SongMomentsBody = z.infer<typeof songMomentsBodySchema>;
