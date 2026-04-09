import { TEMPLATES } from "./templates";

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
