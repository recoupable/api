import { z } from "zod";

/** Responsibilities, not a prescribed sequence of screens or a compulsory tutorial. */
export const openingSequenceSchema = z.object({
  invitation: z
    .string()
    .min(10)
    .describe("Concrete fan-facing premise and reason to participate, connected to this release."),
  initialScene: z
    .string()
    .min(10)
    .describe("What a fresh visitor sees; make the next action visually dominant."),
  firstAction: z
    .string()
    .min(10)
    .describe(
      "One real, forgiving action inside the experience, with a visible cue and accessible control.",
    ),
  response: z
    .string()
    .min(10)
    .describe("Immediate perceptible acknowledgement that teaches cause and effect."),
  earlyReward: z
    .string()
    .min(10)
    .describe("What is satisfying about that action before the final payoff."),
  hesitationHelp: z
    .string()
    .min(10)
    .describe(
      "Contextual help after hesitation, dismissible and recoverable; never advance for the visitor.",
    ),
  growingFreedom: z
    .string()
    .min(10)
    .describe(
      "What successful action unlocks and when guidance fades; returning visitors can resume or replay.",
    ),
});

export const openingSequencePrinciples = `Design the first-time fan journey explicitly: invitation → first action → meaningful response → growing freedom. These are responsibilities, not four mandatory screens.
- Make the premise, release connection and appeal apparent in concise visible copy and composition. Intrigue may concern the outcome, never which control works. Use one dominant next action.
- Teach through a real, forgiving action in the experience. Provide immediate visible cause-and-effect and a small satisfying reward. Avoid instructions that describe controls before they are useful, compulsory generic Start screens, or a cinematic prologue that delays participation.
- Reveal complexity after successful actions, not automatic timers. Offer small contextual hints after hesitation without moving, choosing or finishing for the fan. Let help be dismissed and recovered. Clearly label examples; never start with a sample selected as though the fan chose it.
- Adapt to the form: a safe practice move for a game, an immediate change for a creative tool, an inviting reachable object for exploration, a premise and consequential choice for a story, one rule-revealing move for a puzzle, optional participation for an ambient scene. Do not force every experience into a game or tutorial.
- Keep the opening useful muted, on touch and keyboard, and with reduced motion. Stage entrances must not strand focus or hide controls. Returning visitors can resume or replay without repeating explanations.
- Coordinate with the host's Spotify connection and player: explain the appeal before asking for connection, preserve the fan's work, and avoid stacking welcome, login, tutorial and Start gates. Never implement credentials or email forms inside generated code. Do not claim host authentication was tested by an isolated experience render.
- Prioritize a comprehensible first action and meaningful response over typography micro-polish. Repair confusing cues without replacing a sound concept or adding a tutorial carousel. Use the opening specification when supplied; for an older direction, derive it from the existing activity without changing the payoff.`;
