import { z } from "zod";
export const assetProductionSchema = z.object({
  model: z.enum(["gpt-image-2", "nano-banana-pro", "seedance-2.5"]),
  rationale: z.string().min(8).max(600),
  duration: z.number().int().min(4).max(6).optional(),
});
/** Candidate capabilities, not a claim of measured quality superiority. */
export const assetModelCatalog = [
  {
    id: "gpt-image-2",
    provider: "gateway",
    type: "image",
    job: "Precise composition, detailed art direction, illustration, materials and image editing. Compare for authored hero art.",
    endpoint: "openai/gpt-image-2",
  },
  {
    id: "nano-banana-pro",
    provider: "fal",
    type: "image",
    job: "Reference-led character/product consistency, photographic and illustrated worlds. Compare for identity-sensitive assets.",
    endpoint: "fal-ai/nano-banana-pro",
  },
  {
    id: "seedance-2.5",
    provider: "higgsfield",
    type: "video",
    job: "Short cinematic environmental motion or a reveal clip. Not controllable gameplay, exact type animation or a guaranteed seamless loop. 4–6 seconds, 720p, silent; provide a static fallback.",
    endpoint: "bytedance/seedance-2.5/text-to-video",
  },
] as const;
export const assetSelectionGuidance = `Choose a production model per asset from assetModels and give a specific rationale tied to its purpose. Treat model strengths as hypotheses, not proven rankings. Use relevant priorAssetOutcomes as bounded evidence; they are whole-site reviews and do not isolate model quality. Do not blindly repeat a failing asset choice. Artwork identity, composition, materials and usability matter more than model novelty. GPT Image 2 and Nano Banana Pro are image candidates; Seedance 2.5 is for cinematic video. Keep precise typography, response to input, game state and synchronized interactive motion in live HTML/CSS/SVG/Canvas code. Hyperframes is a deterministic HTML-to-video renderer for authored films; it is NOT installed as a Sites renderer and must not be selected as an available production service. Never replace an interactive payoff with a decorative video. No generated sound; preserve the release player. Retired Recraft, Soul and Muse defaults are unavailable. At most two assets and one 4–6 second video. Preserve supplied artist artwork as reference, never pretend generated likeness is verified. Choose zero assets when well-crafted live graphics are the better medium.`;
