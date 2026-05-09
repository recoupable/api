import type { Tables } from "@/types/database.types";

export type AgentTemplateListFields = Pick<
  Tables<"agent_templates">,
  | "id"
  | "title"
  | "description"
  | "prompt"
  | "tags"
  | "creator"
  | "is_private"
  | "created_at"
  | "favorites_count"
  | "updated_at"
>;

export type ShareRow = {
  templates: AgentTemplateListFields | AgentTemplateListFields[] | null;
};
