import { describe, it, expect } from "vitest";
import { renderScrapeDigestHtml } from "@/lib/apify/digest/renderScrapeDigestHtml";

const SECTIONS = [
  {
    platform: "instagram",
    posts: [
      {
        url: "https://instagram.com/p/abc",
        caption: "Behind the scenes <b>tour</b> & more",
        thumbnailUrl: "https://cdn.example.com/thumb-abc.jpg",
        timestamp: "2026-07-08T12:00:00.000Z",
        stats: { likes: 12345, comments: 678, views: 1200000 },
      },
      { url: "https://instagram.com/p/def", caption: null, thumbnailUrl: null, timestamp: null },
    ],
  },
  {
    platform: "tiktok",
    posts: [
      {
        url: "https://tiktok.com/@a/video/1",
        caption: "New single out now",
        thumbnailUrl: "https://cdn.example.com/cover-1.jpg",
        timestamp: "2026-07-09T09:30:00.000Z",
      },
    ],
  },
];

describe("renderScrapeDigestHtml", () => {
  it("links every new post, grouped under its platform label", () => {
    const { html } = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    for (const s of SECTIONS) for (const p of s.posts) expect(html).toContain(`href="${p.url}"`);
    expect(html).toContain("Instagram");
    expect(html).toContain("TikTok");
  });

  it("labels every wired platform, including LinkedIn", () => {
    const { html } = renderScrapeDigestHtml({
      sections: [{ platform: "linkedin", posts: [{ url: "https://linkedin.com/posts/x" }] }],
      artistName: "A",
    });
    expect(html).toContain("LinkedIn");
  });

  it("renders post media and caption excerpts when available", () => {
    const { html } = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(html).toContain('src="https://cdn.example.com/thumb-abc.jpg"');
    expect(html).toContain('src="https://cdn.example.com/cover-1.jpg"');
    expect(html).toContain("New single out now");
  });

  it("escapes HTML in captions so scraped content cannot inject markup", () => {
    const { html } = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(html).not.toContain("<b>tour</b>");
    expect(html).toContain("&lt;b&gt;tour&lt;/b&gt; &amp; more");
  });

  it("renders compact engagement stats when available", () => {
    const { html } = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(html).toContain("12.3K likes");
    expect(html).toContain("678 comments");
    expect(html).toContain("1.2M views");
  });

  it("still renders a linked card when a post has no media or caption", () => {
    const { html } = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(html).toContain('href="https://instagram.com/p/def"');
  });

  it("is deterministic — identical input renders identical output", () => {
    const a = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    const b = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(a).toEqual(b);
  });

  it("uses the house style — achromatic chrome, no ad-hoc colors", () => {
    const { html } = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(html).toContain("#0a0a0a");
    expect(html).toContain("#e8e8e8");
  });

  it("CTA always points at the chat app, never the API deployment", () => {
    const { html } = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(html).toContain('href="https://chat.recoupable.dev/?q=');
  });

  it("shows the Recoup logo linking to recoupable.com", () => {
    const { html } = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(html).toContain('href="https://recoupable.com"');
    expect(html).toContain('src="https://chat.recoupable.dev/icon-with-background.png"');
  });

  it("names the artist in the roster footer, with a safe fallback", () => {
    const named = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(named.html).toContain("because Ashnikko is in your roster on Recoup");
    const anon = renderScrapeDigestHtml({ sections: SECTIONS });
    expect(anon.html).toContain("because this artist is in your roster on Recoup");
  });

  it("never leaks internal vendor jargon to customers", () => {
    const { html, subject } = renderScrapeDigestHtml({
      sections: SECTIONS,
      artistName: "Ashnikko",
    });
    expect((html + subject).toLowerCase()).not.toContain("apify");
    expect((html + subject).toLowerCase()).not.toContain("dataset");
  });

  it("counts posts and platforms in the subject", () => {
    const { subject } = renderScrapeDigestHtml({ sections: SECTIONS, artistName: "Ashnikko" });
    expect(subject).toBe("Ashnikko: 3 new posts across 2 platforms");
  });
});
