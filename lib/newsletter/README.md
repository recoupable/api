# Recoup Research enrollment

Only `POST /api/leads` subscribe requests with `newsletter_consent: "recoup-research-v1"` enroll a reader. Legacy contact captures are unchanged.

Requires existing `RESEND_API_KEY`, `RESEND_RESEARCH_SEGMENT_ID`, and explicit `RESEND_RESEARCH_READY=true`. Keep the ready gate disabled until provider segment-entry welcome automation, sender, reply routing and unsubscribe are verified. This module does not itself send the welcome email.

Read the contact first; never reset unsubscribe state. Provider failure prevents a success response. Duplicate segment membership/re-entry behavior must be validated with the configured automation before launch. Attio person storage must also succeed. The attribution/consent note uses the existing best-effort note writer, so it is not a guaranteed consent audit log. Verify provider subscription evidence before broadcasting; do not use CRM membership as consent.

Manual release checks: fresh signup, repeat signup without repeat welcome, suppressed address, actual welcome receipt, example link, reply, unsubscribe, and suppression on a later broadcast. Use only an authorized test address. No real address or secret belongs in tests.
