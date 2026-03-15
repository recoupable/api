export interface ContentTemplate {
  name: string;
  description: string;
  defaultLipsync: boolean;
}

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    name: "artist-caption-bedroom",
    description: "Moody purple bedroom setting",
    defaultLipsync: false,
  },
  {
    name: "artist-caption-outside",
    description: "Night street scene",
    defaultLipsync: false,
  },
  {
    name: "artist-caption-stage",
    description: "Small venue concert",
    defaultLipsync: false,
  },
];

/** Derived from the first entry in CONTENT_TEMPLATES to avoid string duplication. */
export const DEFAULT_CONTENT_TEMPLATE = CONTENT_TEMPLATES[0].name;

/**
 *
 * @param template
 */
export function isSupportedContentTemplate(template: string): boolean {
  return CONTENT_TEMPLATES.some(item => item.name === template);
}
