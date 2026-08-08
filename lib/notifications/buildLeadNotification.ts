/** A captured marketing lead, already validated by the route. */
export interface LeadNotificationInput {
  email: string;
  source: string;
  name?: string;
  company?: string;
  role?: string;
  package?: string;
  rosterSize?: string;
  message?: string;
}

/**
 * Formats a captured lead as the Telegram message a human reads.
 *
 * Package, company and role are the triage fields — a $5,000/mo retained
 * advisory enquiry and a newsletter signup must be distinguishable without
 * opening the CRM (recoupable/chat#1800).
 *
 * @param lead - The captured lead.
 * @returns The message body for sendSalesNotification.
 */
export function buildLeadNotification(lead: LeadNotificationInput): string {
  return [
    `🎯 New lead — ${lead.source}`,
    lead.name ? `${lead.name} <${lead.email}>` : lead.email,
    lead.package && `Package: ${lead.package}`,
    lead.company && `Company: ${lead.company}`,
    lead.role && `Role: ${lead.role}`,
    lead.rosterSize && `Roster: ${lead.rosterSize}`,
    lead.message && `Message: ${lead.message}`,
  ]
    .filter(Boolean)
    .join("\n");
}
