import type { Template } from "./types";
import bedroomTemplate from "./artist-caption-bedroom";
import outsideTemplate from "./artist-caption-outside";
import stageTemplate from "./artist-caption-stage";
import recordStoreTemplate from "./album-record-store";

export const TEMPLATES = {
  "artist-caption-bedroom": bedroomTemplate,
  "artist-caption-outside": outsideTemplate,
  "artist-caption-stage": stageTemplate,
  "album-record-store": recordStoreTemplate,
} as const satisfies Record<string, Template>;

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as [string, ...string[]];
