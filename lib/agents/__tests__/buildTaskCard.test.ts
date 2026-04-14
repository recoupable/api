import { describe, it, expect, vi } from "vitest";

import { buildTaskCard } from "../buildTaskCard";
import { LinkButton } from "chat";

vi.mock("chat", () => ({
  Card: vi.fn(({ title, children }) => ({ type: "card", title, children })),
  CardText: vi.fn((text: string) => ({ type: "cardText", text })),
  Actions: vi.fn((buttons: unknown[]) => ({ type: "actions", buttons })),
  LinkButton: vi.fn(({ url, label }: { url: string; label: string }) => ({
    type: "linkButton",
    url,
    label,
  })),
}));

describe("buildTaskCard", () => {
  it("returns a card with title, message, and View Task link button", () => {
    const card = buildTaskCard("Task Started", "Working on it...", "run-abc-123");

    expect(card).toEqual({
      type: "card",
      title: "Task Started",
      children: [
        { type: "cardText", text: "Working on it..." },
        {
          type: "actions",
          buttons: [
            {
              type: "linkButton",
              url: "https://chat.recoupable.com/tasks/run-abc-123",
              label: "View Task",
            },
          ],
        },
      ],
    });
  });

  it("uses the correct URL format with the run ID", () => {
    vi.mocked(LinkButton).mockClear();
    buildTaskCard("Title", "Message", "my-run-id");

    expect(LinkButton).toHaveBeenCalledWith({
      url: "https://chat.recoupable.com/tasks/my-run-id",
      label: "View Task",
    });
  });
});
