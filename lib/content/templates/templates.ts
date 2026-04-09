import type { Template } from "./types";
import bedroomTemplate from "./artist-caption-bedroom";
import outsideTemplate from "./artist-caption-outside";
import stageTemplate from "./artist-caption-stage";
import recordStoreTemplate from "./album-record-store";

export const TEMPLATE_IDS = [
  "artist-caption-bedroom",
  "artist-caption-outside",
  "artist-caption-stage",
  "album-record-store",
] as const;

export const TEMPLATES: Record<string, Template> = {
  "artist-caption-bedroom": bedroomTemplate,
  "artist-caption-outside": outsideTemplate,
  "artist-caption-stage": stageTemplate,
  "album-record-store": recordStoreTemplate,
};
