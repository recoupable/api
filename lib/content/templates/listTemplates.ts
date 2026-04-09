import type { Template } from "./types";
import bedroomTemplate from "./artist-caption-bedroom";
import outsideTemplate from "./artist-caption-outside";
import stageTemplate from "./artist-caption-stage";
import recordStoreTemplate from "./album-record-store";

const TEMPLATES: Template[] = [
  bedroomTemplate,
  outsideTemplate,
  stageTemplate,
  recordStoreTemplate,
];

/**
 * List all available templates with id and description only.
 *
 * @returns Array of template summaries.
 */
export function listTemplates(): { id: string; description: string }[] {
  return TEMPLATES.map(t => ({
    id: t.id,
    description: t.description,
  }));
}
