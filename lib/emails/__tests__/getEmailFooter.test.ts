import { describe, expect, it } from "vitest";
import { getEmailFooter } from "../getEmailFooter";

describe("getEmailFooter", () => {
  it("includes reply note in all cases", () => {
    const footer = getEmailFooter();
    expect(footer).toContain("you can reply directly to this email");
  });

  it("includes horizontal rule", () => {
    const footer = getEmailFooter();
    expect(footer).toContain("<hr");
  });

  it("excludes chat link when roomId is not provided", () => {
    const footer = getEmailFooter();
    expect(footer).not.toContain("chat.recoupable.com");
    expect(footer).not.toContain("Or continue the conversation");
  });

  it("includes chat link when roomId is provided", () => {
    const roomId = "test-room-123";
    const footer = getEmailFooter(roomId);
    expect(footer).toContain(`https://chat.recoupable.com/chat/${roomId}`);
    expect(footer).toContain("Or continue the conversation on Recoup");
  });

  it("generates proper HTML with roomId", () => {
    const roomId = "my-room-id";
    const footer = getEmailFooter(roomId);
    expect(footer).toContain(`href="https://chat.recoupable.com/chat/${roomId}"`);
    expect(footer).toContain('target="_blank"');
    expect(footer).toContain('rel="noopener noreferrer"');
  });

  it("applies proper styling", () => {
    const footer = getEmailFooter("room-id");
    expect(footer).toContain("font-size:12px");
    expect(footer).toContain("color:#6b7280");
  });

  it("includes artist workspace when artistName is provided", () => {
    const footer = getEmailFooter("room-id", "Taylor Swift");
    expect(footer).toContain("From Taylor Swift's workspace");
  });

  it("excludes artist line when artistName is not provided", () => {
    const footer = getEmailFooter("room-id");
    expect(footer).not.toContain("workspace");
  });

  it("includes artist workspace without roomId", () => {
    const footer = getEmailFooter(undefined, "Drake");
    expect(footer).toContain("From Drake's workspace");
    expect(footer).not.toContain("chat.recoupable.com");
  });
});
