import type { Template } from "./types";
import { TEMPLATES } from "./templates";

/**
 * Load a template by ID. Returns null if not found.
 *
 * @param id - Template identifier.
 * @returns The full template config, or null.
 */
export function loadTemplate(id: string): Template | null {
  return TEMPLATES[id] ?? null;
}
