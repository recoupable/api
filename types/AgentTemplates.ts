/** Response row for `GET /api/agent-templates` (matches public OpenAPI). */
export type AgentTemplateRow = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tags: string[] | null;
  creator: string | null;
  is_private: boolean;
  created_at: string | null;
  favorites_count: number | null;
  updated_at: string | null;
  is_favourite: boolean;
  shared_emails: string[];
};
