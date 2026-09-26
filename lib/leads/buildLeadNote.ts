import type { PostLeadsBody } from "@/lib/leads/validatePostLeadsBody";
import { packageLabel } from "@/lib/leads/packageLabel";

/** Formats a Record payload as "key: value" lines for a note body. */
function recordLines(record: Record<string, unknown> | undefined): string[] {
  return Object.entries(record ?? {}).map(([key, value]) => `${key}: ${String(value)}`);
}

/**
 * Formats every captured lead as an Attio activity note, including plain
 * signups whose source and campaign tags would otherwise be discarded.
 *
 * The "Advisory Inquiry" title prefix is what the CRM is searched by, so it
 * must stay stable — ported from marketing#68 (recoupable/chat#1800). The
 * audit and ROI notes carry the qualifying payloads marketing's schema used to
 * strip (superseded marketing#71).
 *
 * @param lead - The validated lead.
 * @returns The note title and content.
 */
export function buildLeadNote(lead: PostLeadsBody): { title: string; content: string } {
  if (lead.kind === "booking") {
    const label = packageLabel(lead.package);
    const content = [
      `📅 Advisory Booking Request`,
      `Package: ${label}`,
      lead.company && `Company: ${lead.company}`,
      lead.role && `Role: ${lead.role}`,
      lead.rosterSize && `Roster Size: ${lead.rosterSize}`,
      lead.message && `Message: ${lead.message}`,
      `Source: ${lead.source}`,
    ]
      .filter(Boolean)
      .join("\n");
    return { title: `Advisory Inquiry: ${label}`, content };
  }

  // Record this submission's attribution as history, never as a replacement
  // for an existing person's acquisition source or commercial status.
  const attribution = [
    `Source: ${lead.source}`,
    lead.utm_source && `UTM source: ${lead.utm_source}`,
    lead.utm_medium && `UTM medium: ${lead.utm_medium}`,
    lead.utm_campaign && `UTM campaign: ${lead.utm_campaign}`,
    lead.source_post_slug && `Source post: ${lead.source_post_slug}`,
  ].filter(Boolean);

  if (lead.audit_score !== undefined || lead.audit_answers) {
    const content = [
      `🧮 AI Readiness Audit`,
      lead.audit_score !== undefined && `Score: ${lead.audit_score}`,
      lead.company && `Company: ${lead.company}`,
      ...recordLines(lead.audit_answers),
      ...attribution,
    ]
      .filter(Boolean)
      .join("\n");
    const title =
      lead.audit_score !== undefined
        ? `AI Readiness Audit: ${lead.audit_score}`
        : "AI Readiness Audit";
    return { title, content };
  }

  if (lead.roi_inputs || lead.roi_results) {
    const content = [
      `📈 ROI Calculator`,
      lead.company && `Company: ${lead.company}`,
      ...recordLines(lead.roi_inputs),
      ...recordLines(lead.roi_results),
      ...attribution,
    ]
      .filter(Boolean)
      .join("\n");
    return { title: "ROI Calculator", content };
  }

  return {
    title: "Website Signup",
    content: [lead.company && `Company: ${lead.company}`, ...attribution]
      .filter(Boolean)
      .join("\n"),
  };
}
