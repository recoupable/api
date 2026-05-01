import { CONTENT_TEMPLATES } from "./contentTemplates";

/**
 * Checks if a template name is in the supported templates list.
 *
 * @param template - The template name to validate
 * @returns Whether the template is supported
 */
export function isSupportedContentTemplate(template: string): boolean {
  return CONTENT_TEMPLATES.some(item => item.name === template);
}
