import type { PackLyricMediaCapability } from "./packLyricRenderTypes";
/** Fetch before allocating a renderer; cancellation never races deletion of a runtime directory. */
export async function fetchPackLyricSources(capability: PackLyricMediaCapability, urls: string[]) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const requests = urls.map(url =>
    Promise.resolve().then(() =>
      capability.fetchMedia(url, {
        signal: controller.signal,
        maxBytes: 50 * 1024 * 1024,
      }),
    ),
  );
  try {
    return await Promise.race([
      Promise.all(requests),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Lyric source fetch deadline exceeded")), 180000);
      }),
    ]);
  } catch (error) {
    controller.abort();
    let settlement: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled(requests),
        new Promise<never>((_, reject) => {
          settlement = setTimeout(
            () =>
              reject(
                new Error("Lyric fetch cancellation unconfirmed; no runtime allocated", {
                  cause: error,
                }),
              ),
            5000,
          );
        }),
      ]);
    } finally {
      if (settlement) clearTimeout(settlement);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
