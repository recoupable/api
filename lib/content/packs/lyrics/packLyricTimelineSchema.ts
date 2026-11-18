import { z } from "zod";
import { hasPackTextContent } from "../hasPackTextContent";

// Internal experimental renderer bounds, not a supported product policy.
const time = z.number().int().min(0).max(1_200_000);
const range = z
  .object({ startMs: time, endMs: time })
  .strict()
  .refine(value => value.endMs > value.startMs, "Range must have positive duration");
const reference = z
  .string()
  .min(1)
  .max(512)
  .refine(
    value =>
      hasPackTextContent(value) &&
      value === value.trim() &&
      !/[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(value) &&
      !/^(?:n\/a|none|unknown|unavailable|not available|not applicable|unverified|null|undefined|pending|placeholder)$/i.test(
        value,
      ),
    "A substantive evidence or identity reference is required",
  );
const wordText = z
  .string()
  .max(256)
  .refine(
    value =>
      hasPackTextContent(value) &&
      [...value].length <= 128 &&
      new TextEncoder().encode(value).length <= 512 &&
      !/[\p{Cc}\p{Cs}\p{Zl}\p{Zp}\u202a-\u202e\u2066-\u2069]/u.test(value),
    "Word text must be bounded literal Unicode without unsafe controls",
  );
const target = z
  .object({
    jobId: z.string().uuid(),
    jobRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    assetId: z.string().uuid(),
    assetAttempt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    recording: z
      .object({
        storageKey: reference,
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        durationMs: time.refine(value => value > 0, "Recording duration must be positive"),
      })
      .strict(),
    excerpt: range,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.excerpt.endMs > value.recording.durationMs ||
      value.excerpt.endMs - value.excerpt.startMs > 60_000
    )
      ctx.addIssue({
        code: "custom",
        message: "Excerpt exceeds recording or internal 60-second bound",
        path: ["excerpt"],
      });
  });
const alignmentEvidence = {
  revision: reference,
  evidenceRef: reference,
  verificationRef: reference,
  verifiedRange: range,
};
const alignment = z
  .object({
    target,
    ...alignmentEvidence,
    words: z.array(z.object({ text: wordText, startMs: time, endMs: time }).strict()).max(1000),
  })
  .strict()
  .superRefine((value, ctx) => {
    const verified = value.verifiedRange;
    const excerpt = value.target.excerpt;
    if (
      verified.endMs > value.target.recording.durationMs ||
      verified.startMs > excerpt.startMs ||
      verified.endMs < excerpt.endMs
    )
      ctx.addIssue({
        code: "custom",
        message: "Verified range must cover the exact excerpt within the recording",
        path: ["verifiedRange"],
      });
    let bytes = 0;
    value.words.forEach((word, index) => {
      bytes += new TextEncoder().encode(word.text).length;
      if (
        word.endMs <= word.startMs ||
        word.startMs < verified.startMs ||
        word.endMs > verified.endMs ||
        (index > 0 && word.startMs < value.words[index - 1].endMs)
      )
        ctx.addIssue({
          code: "custom",
          message: "Words must be positive, ordered, non-overlapping and within the verified range",
          path: ["words", index],
        });
    });
    if (bytes > 65_536)
      ctx.addIssue({
        code: "custom",
        message: "Alignment exceeds internal 64-KiB text bound",
        path: ["words"],
      });
  });
const typography = z.literal("portrait-word-v1");

/** Structural checks do not authenticate caller-supplied verification references. */
export const packLyricTimelineSchema = z
  .object({
    expected: target,
    alignment: alignment.nullish(),
    typography,
  })
  .strict()
  .superRefine((value, ctx) => {
    // Both strict parsed targets have the same schema-defined property order.
    if (
      value.alignment &&
      JSON.stringify(value.expected) !== JSON.stringify(value.alignment.target)
    )
      ctx.addIssue({
        code: "custom",
        message: "Alignment does not match the expected Pack target",
        path: ["alignment", "target"],
      });
  });

type PackLyricTarget = z.infer<typeof target>;
type PackLyricEvidence = z.infer<typeof alignment>;
export type PackLyricTimelineResult = {
  target: PackLyricTarget;
  typography: z.infer<typeof typography>;
} & (
  | { status: "gap"; reason: "missing_verified_alignment" | "no_aligned_words" }
  | {
      status: "ready";
      alignment: Pick<
        PackLyricEvidence,
        "revision" | "evidenceRef" | "verificationRef" | "verifiedRange"
      >;
      cues: {
        text: string;
        startMs: number;
        endMs: number;
        sourceStartMs: number;
        sourceEndMs: number;
      }[];
    }
);
