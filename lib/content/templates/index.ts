import bedroomTemplate from "./artist-caption-bedroom.json";
import outsideTemplate from "./artist-caption-outside.json";
import stageTemplate from "./artist-caption-stage.json";
import recordStoreTemplate from "./album-record-store.json";

export interface TemplateEditOperation {
  type: string;
  [key: string]: unknown;
}

export interface Template {
  id: string;
  description: string;
  image: {
    prompt: string;
    reference_images: string[];
    style_rules: Record<string, Record<string, string>>;
  };
  video: {
    moods: string[];
    movements: string[];
  };
  caption: {
    guide: {
      templateStyle?: string;
      captionRole?: string;
      tone: string;
      rules: string[];
      formats: string[];
    };
    examples: string[];
  };
  edit: {
    operations: TemplateEditOperation[];
  };
}

const TEMPLATES: Record<string, Template> = {
  "artist-caption-bedroom": bedroomTemplate as unknown as Template,
  "artist-caption-outside": outsideTemplate as unknown as Template,
  "artist-caption-stage": stageTemplate as unknown as Template,
  "album-record-store": recordStoreTemplate as unknown as Template,
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

/**
 * List all available templates with id and description only.
 *
 * @returns Array of template summaries.
 */
export function listTemplates(): { id: string; description: string }[] {
  return Object.values(TEMPLATES).map(t => ({
    id: t.id,
    description: t.description,
  }));
}
