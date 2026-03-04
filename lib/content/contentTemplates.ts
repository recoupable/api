export interface ContentTemplate {
  name: string;
  description: string;
  defaultLipsync: boolean;
}

export const DEFAULT_CONTENT_TEMPLATE = "artist-caption-bedroom";

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

/**
 *
 * @param template
 */
export function isSupportedContentTemplate(template: string): boolean {
  return CONTENT_TEMPLATES.some(item => item.name === template);
}
