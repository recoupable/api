import type { Template } from "./types";
import bedroomTemplate from "./artist-caption-bedroom";
import outsideTemplate from "./artist-caption-outside";
import stageTemplate from "./artist-caption-stage";
import recordStoreTemplate from "./album-record-store";

const TEMPLATES: Record<string, Template> = {
  "artist-caption-bedroom": bedroomTemplate,
  "artist-caption-outside": outsideTemplate,
  "artist-caption-stage": stageTemplate,
  "album-record-store": recordStoreTemplate,
};

/**
 * Load a template by ID. Returns null if not found.
 *
 * @param id - Template identifier.
 * @returns The full template config, or null.
 */
export function loadTemplate(id: string): Template | null {
  return TEMPLATES[id] ?? null;
}
