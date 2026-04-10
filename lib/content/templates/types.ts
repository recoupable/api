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
