import { describe, it, expect } from "vitest";
import { extractRoomIdFromHtml } from "../extractRoomIdFromHtml";

describe("extractRoomIdFromHtml", () => {
  describe("Superhuman reply with conversation link in quoted content", () => {
    it("extracts roomId from Superhuman reply with wbr tags in link text", () => {
      // This is the actual HTML from a Superhuman reply where the link text
      // contains <wbr /> tags for word breaking
      const html = `<html>

<head></head>

<body>
  <div>
    <div>
      <div>
        <div class="">Send a picture of him <br /></div>
        <div class=""><br /></div>
      </div>
      <div>
        <div style="display: none; border: 0px; width: 0px; height: 0px; overflow: hidden; visibility: hidden;"><img src="https://r.superhuman.com/4640qXWivTiaNi_anz1bstqoUbWlYj8nnSM0Y-NWmoL_OZdXZ1Zq-_DSPSu7r6M_NMQJAgHCnrKL5OisY6deh83uz8MfXoijSTOwhFcnM5Ya0RU8q8kZDoD0MVTLFtwDxERoN1wu0T-LgI8TDjcWI8K1HEns5_8ETb2EF1fetEenZgrj73FE6Q.gif" alt=" " width="1" height="0" style="display: none; border: 0px; width: 0px; height: 0px; overflow: hidden; visibility: hidden;" /><!--                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                --></div><br />
        <div class="gmail_signature">
          <div style="clear:both">Sent via <a href="https://sprh.mn/?vip=sidney@recoupable.com" target="_blank">Superhuman</a></div><br />
        </div>
      </div><br />
      <div>
        <div class="gmail_quote">On Fri, Jan 09, 2026 at 11:59 AM, Agent by Recoup <span dir="ltr">&lt;<a href="mailto:agent@recoupable.com" target="_blank">agent@recoupable.com</a>&gt;</span> wrote:<br />
          <blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex">
            <div class="gmail_extra">
              <div class="gmail_quote sh-color-black sh-color">
                <p class="sh-color-black sh-color">Short answer: Brian Kernighan.</p>
                <p class="sh-color-black sh-color">Details: the earliest known use in computing appears in Kernighan's 1972 tutorial for the B language (the "hello, world!" example). It was then popularized by Kernighan &amp; Ritchie's 1978 book The C Programming Language. (There are older claims—BCPL examples from the late 1960s and the exact phrase appeared as a radio catchphrase in the 1950s—but Kernighan is usually credited for putting it into programming tradition.)</p>
                <p cor-black sh-color">Want the sources/links?</p>


                <hr style="margin-top:24px;margin-bottom:16px;border:none;border-top:1px solid #e5e7eb;" class="sh-color-grey sh-color" />
                <p style="font-size:12px;color:#6b7280;margin:0 0 4px;" class="sh-color-grey sh-color">
                  Note: you can reply directly to this email to continue the conversation.
                </p>
                <p style="font-size:12px;color:#6b7280;margin:0;" class="sh-color-grey sh-color">
                  Or continue the conversation on Recoup:
                  <a href="https://14158f8b1cbe93481ac078c1f43f3792.us-east-1.resend-links.com/CL0/https:%2F%2Fchat.recoupable.com%2Fchat%2Fd5c473ec-04cf-4a23-a577-e0dc71542392/1/0100019ba3b2dbec-832401f0-a3c6-4478-b6bf-3b0b06b7251a-000000/OomH25B53Pym0ykT2YYxbKx0c_NEhvJ3oFfBzpKKdVk=439" rel="noopener noreferrer" target="_blank" class="sh-color-blue sh-color">
                    https:/<wbr />/<wbr />chat.<wbr />recoupable.<wbr />com/<wbr />chat/<wbr />d5c473ec-04cf-4a23-a577-e0dc71542392
                  </a>
                </p>
              </div>
            </div>
          </blockquote>
        </div>
      </div><br />
    </div>
  </div>
</body>

</html>`;

      const result = extractRoomIdFromHtml(html);

      expect(result).toBe("d5c473ec-04cf-4a23-a577-e0dc71542392");
    });
  });

  describe("Gmail reply with proper threading", () => {
    it("extracts roomId from Gmail reply with quoted content", () => {
      const html = `
        <html>
          <body>
            <p>Thanks for the info!</p>
            <div class="gmail_quote">
              <blockquote>
                <p>Original message here</p>
                <p>Continue the conversation: <a href="https://chat.recoupable.com/chat/a1b2c3d4-e5f6-7890-abcd-ef1234567890">https://chat.recoupable.com/chat/a1b2c3d4-e5f6-7890-abcd-ef1234567890</a></p>
              </blockquote>
            </div>
          </body>
        </html>
      `;

      const result = extractRoomIdFromHtml(html);

      expect(result).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    });
  });

  describe("no conversation ID", () => {
    it("returns undefined for undefined input", () => {
      const result = extractRoomIdFromHtml(undefined);

      expect(result).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      const result = extractRoomIdFromHtml("");

      expect(result).toBeUndefined();
    });

    it("returns undefined when no chat link present", () => {
      const html = "<html><body><p>This email has no Recoup chat link.</p></body></html>";

      const result = extractRoomIdFromHtml(html);

      expect(result).toBeUndefined();
    });

    it("returns undefined for invalid UUID format in link", () => {
      const html = '<a href="https://chat.recoupable.com/chat/not-a-valid-uuid">link</a>';

      const result = extractRoomIdFromHtml(html);

      expect(result).toBeUndefined();
    });

    it("returns undefined for wrong domain", () => {
      const html =
        '<a href="https://chat.otherdomain.com/chat/550e8400-e29b-41d4-a716-446655440000">link</a>';

      const result = extractRoomIdFromHtml(html);

      expect(result).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("handles URL-encoded link in href attribute", () => {
      // Resend tracking redirects URL-encode the destination
      const html =
        '<a href="https://tracking.example.com/redirect/https:%2F%2Fchat.recoupable.com%2Fchat%2F12345678-1234-1234-1234-123456789abc">Click here</a>';

      const result = extractRoomIdFromHtml(html);

      expect(result).toBe("12345678-1234-1234-1234-123456789abc");
    });

    it("extracts first roomId when multiple links present", () => {
      const html = `
        <a href="https://chat.recoupable.com/chat/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee">First</a>
        <a href="https://chat.recoupable.com/chat/11111111-2222-3333-4444-555555555555">Second</a>
      `;

      const result = extractRoomIdFromHtml(html);

      expect(result).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    });

    it("handles link text with wbr tags breaking up the URL", () => {
      const html = `
        <a href="#">
          https:/<wbr />/<wbr />chat.<wbr />recoupable.<wbr />com/<wbr />chat/<wbr />abcdef12-3456-7890-abcd-ef1234567890
        </a>
      `;

      const result = extractRoomIdFromHtml(html);

      expect(result).toBe("abcdef12-3456-7890-abcd-ef1234567890");
    });

    it("handles mixed case in URL", () => {
      const html =
        '<a href="HTTPS://CHAT.RECOUPABLE.COM/CHAT/12345678-1234-1234-1234-123456789abc">link</a>';

      const result = extractRoomIdFromHtml(html);

      expect(result).toBe("12345678-1234-1234-1234-123456789abc");
    });
  });
});
