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
  {
    name: "album-record-store",
    description: "Album art on vinyl in a NYC record store",
    defaultLipsync: false,
  },
  {
    name: "artist-release-editorial",
    description: "Editorial promo featuring artist press photo, playlist covers, and DSP branding",
    defaultLipsync: false,
  },
];

/** Derived from the first entry in CONTENT_TEMPLATES to avoid string duplication. */
export const DEFAULT_CONTENT_TEMPLATE = CONTENT_TEMPLATES[0].name;
