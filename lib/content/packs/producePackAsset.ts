import type { PackJob, PackAsset, PackFile } from "./packTypes";
import { buildPackAssetPrompt } from "./buildPackAssetPrompt";
export type PackComposition = {
  files: PackFile[];
  probe: {
    [key: string]: unknown;
    duration?: number;
    audio?: boolean;
    width?: number;
    height?: number;
  };
};
export type PackProductionServices = {
  phase: (name: string, value: unknown) => Promise<unknown>;
  generateImages: (prompt: string, count: number) => Promise<string[]>;
  generateMotion: (prompt: string, image: string) => Promise<string>;
  caption: (prompt: string) => Promise<string>;
  compose: (input: {
    images: string[];
    motion?: string;
    audioUrl: string;
    start: number;
    seconds: number;
    visualizer: boolean;
  }) => Promise<PackComposition>;
  inspect: (input: {
    files: PackFile[];
    prompt: string;
    caption: string;
    probe: PackComposition["probe"];
  }) => Promise<{ [key: string]: unknown; passed: boolean; reason: string }>;
  finish: (result: Record<string, unknown>) => Promise<unknown>;
};
/** Durable stage outputs are reused on resume. QA failure never means a usable asset. */
export async function producePackAsset(
  job: PackJob,
  asset: PackAsset,
  services: PackProductionServices,
) {
  const state = { ...asset.provider_state };
  async function stage<T>(name: string, run: () => Promise<T>): Promise<T> {
    if (state[name] !== undefined) return state[name] as T;
    const value = await run();
    await services.phase(name, value);
    state[name] = value;
    return value;
  }
  const prompt = buildPackAssetPrompt(job.brief, asset.kind, asset.ordinal);
  const images = await stage("images", () =>
    services.generateImages(
      prompt +
        (asset.kind === "quote_card"
          ? " Render only the verified lyric excerpt if available; otherwise use the exact song title, never a fabricated quote."
          : ""),
      asset.kind === "carousel" ? 4 : 1,
    ),
  );
  const motion =
    asset.kind === "video"
      ? await stage("motion", () =>
          services.generateMotion(
            prompt +
              " Use restrained intentional motion, preserve supplied artwork identity and leave room for music-driven editing.",
            images[0],
          ),
        )
      : undefined;
  const caption = await stage("caption", () => services.caption(prompt));
  const composition = await stage("composition", () =>
    services.compose({
      images,
      motion,
      audioUrl: job.brief.audio_url!,
      start: job.brief.audio_start_seconds ?? 0,
      seconds: job.deliverables.video_seconds,
      visualizer: asset.kind === "visualizer",
    }),
  );
  const qa = await stage("inspection", () =>
    services.inspect({ files: composition.files, prompt, caption, probe: composition.probe }),
  );
  await services.finish({
    status: qa.passed ? "completed" : "failed",
    files: composition.files,
    caption,
    qa,
    error: qa.passed ? null : qa.reason,
  });
}
