# Feature: Inbound Email Client

## Overview

The inbound email feature allows users to interact with the Recoup AI via email. When someone sends an email to a Recoup email address (e.g., `support@mail.recoupable.com`), the system:

1. Receives the email via a Resend webhook
2. Processes it through the AI agent
3. Sends back an AI-generated reply in the same email thread
4. Stores the conversation in the database

This creates a seamless email-based chat experience with full conversation continuity between email and web.

---

## External Service: Resend

The feature uses **[Resend](https://resend.com)** for:
- **Receiving emails** via webhooks (`email.received` events)
- **Fetching email content** (webhooks only send metadata, not the body)
- **Sending reply emails** with proper threading (`In-Reply-To` header)

**Required Environment Variable:**
```
RESEND_API_KEY=your_resend_api_key
```

---

## File Structure

### Entry Point
```
app/api/emails/inbound/route.ts              ← Webhook endpoint (POST)
```

### Core Email Logic
```
lib/emails/
├── client.ts                                ← Resend client factory
├── sendEmail.ts                             ← sendEmailWithResend()
├── validateInboundEmailEvent.ts             ← Zod schema validation
├── isTestEmail.ts                           ← Test email detection
└── inbound/
    ├── handleInboundEmail.ts                ← Main orchestrator
    ├── respondToInboundEmail.ts             ← Response coordination
    ├── validateNewEmailMemory.ts            ← Room creation & dedup
    ├── generateEmailResponse.ts             ← AI response generation
    ├── getEmailContent.ts                   ← Fetch email body from Resend
    ├── getEmailRoomId.ts                    ← Thread → Room mapping
    ├── getEmailRoomMessages.ts              ← Conversation history
    ├── getFromWithName.ts                   ← Format "from" address
    └── trimRepliedContext.ts                ← Strip quoted replies
```

### AI & Prompts
```
lib/agents/generalAgent/
└── getGeneralAgent.ts                       ← Creates the AI agent

lib/chat/
├── const.ts                                 ← SYSTEM_PROMPT (main prompt)
├── buildSystemPromptWithImages.ts           ← Add image context
├── createNewRoom.ts                         ← Room creation + notifications
├── generateChatTitle.ts                     ← AI-generated title
├── setupToolsForRequest.ts                  ← Load MCP tools
├── validateChatRequest.ts                   ← Request body schema
├── filterExcludedTools.ts                   ← Tool filtering
└── types.ts                                 ← RoutingDecision type

lib/prompts/
└── getSystemPrompt.ts                       ← Dynamic prompt assembly
```

### Database Operations
```
lib/supabase/
├── account_emails/
│   └── selectAccountEmails.ts               ← Email → Account lookup
├── memories/
│   ├── insertMemories.ts                    ← Store messages
│   └── selectMemories.ts                    ← Retrieve conversation
├── memory_emails/
│   ├── insertMemoryEmail.ts                 ← Link email to memory
│   └── selectMemoryEmails.ts                ← Find existing threads
└── rooms/
    └── insertRoom.ts                        ← Create conversation room
```

### Utilities
```
lib/messages/
├── getMessages.ts                           ← Convert text to UIMessage
├── filterMessageContentForMemories.ts       ← Format for storage
├── extractImageUrlsFromMessages.ts          ← Image handling
└── validateMessages.ts                      ← Message validation

lib/uuid/
└── generateUUID.ts                          ← Generate unique IDs

lib/telegram/
└── sendNewConversationNotification.ts       ← Team notifications
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `account_emails` | Links email addresses to account IDs |
| `memories` | Stores conversation messages (user and assistant) |
| `memory_emails` | Links emails to memory records for thread tracking |
| `rooms` | Represents conversation rooms |

---

## Key Functions Reference

| Function | File | Purpose |
|----------|------|---------|
| `handleInboundEmail()` | `lib/emails/inbound/handleInboundEmail.ts` | Main orchestrator for webhook |
| `validateInboundEmailEvent()` | `lib/emails/validateInboundEmailEvent.ts` | Zod validation of webhook |
| `respondToInboundEmail()` | `lib/emails/inbound/respondToInboundEmail.ts` | Coordinates response flow |
| `validateNewEmailMemory()` | `lib/emails/inbound/validateNewEmailMemory.ts` | Room creation & duplicate detection |
| `generateEmailResponse()` | `lib/emails/inbound/generateEmailResponse.ts` | AI response generation |
| `getEmailContent()` | `lib/emails/inbound/getEmailContent.ts` | Fetches email body from Resend |
| `getEmailRoomId()` | `lib/emails/inbound/getEmailRoomId.ts` | Maps email thread to room |
| `getEmailRoomMessages()` | `lib/emails/inbound/getEmailRoomMessages.ts` | Gets conversation history |
| `trimRepliedContext()` | `lib/emails/inbound/trimRepliedContext.ts` | Strips quoted replies |
| `getFromWithName()` | `lib/emails/inbound/getFromWithName.ts` | Formats "from" address |
| `sendEmailWithResend()` | `lib/emails/sendEmail.ts` | Sends email via Resend |
| `getGeneralAgent()` | `lib/agents/generalAgent/getGeneralAgent.ts` | Creates AI agent |
| `getSystemPrompt()` | `lib/prompts/getSystemPrompt.ts` | Builds dynamic system prompt |
| `createNewRoom()` | `lib/chat/createNewRoom.ts` | Creates room + sends notifications |
| `generateChatTitle()` | `lib/chat/generateChatTitle.ts` | AI-generates conversation title |

---

## User Journey 1: First Email (New Conversation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USER SENDS FIRST EMAIL                                │
│                                                                              │
│  From: manager@label.com                                                     │
│  To: support@mail.recoupable.com                                             │
│  Subject: Help with TikTok strategy                                          │
│  Body: "How can I grow my artist's TikTok following?"                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. RESEND WEBHOOK → POST /api/emails/inbound                               │
│     File: app/api/emails/inbound/route.ts                                    │
│     Function: POST() → handleInboundEmail()                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. VALIDATE WEBHOOK PAYLOAD                                                 │
│     File: lib/emails/validateInboundEmailEvent.ts                            │
│     Function: validateInboundEmailEvent(body)                                │
│                                                                              │
│     Checks: type="email.received", email_id, from, to, message_id, etc.     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. START RESPONSE FLOW                                                      │
│     File: lib/emails/inbound/respondToInboundEmail.ts                        │
│     Function: respondToInboundEmail(event)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. VALIDATE & CREATE MEMORY                                                 │
│     File: lib/emails/inbound/validateNewEmailMemory.ts                       │
│     Function: validateNewEmailMemory(event)                                  │
│                                                                              │
│     Step A: Look up sender in account_emails table                          │
│             → Found: manager@label.com → account_id: "abc-123"               │
│                                                                              │
│     Step B: Fetch full email body from Resend                               │
│             File: lib/emails/inbound/getEmailContent.ts                      │
│                                                                              │
│     Step C: Strip quoted reply text                                         │
│             File: lib/emails/inbound/trimRepliedContext.ts                   │
│                                                                              │
│     Step D: Check for existing room (via references header)                 │
│             File: lib/emails/inbound/getEmailRoomId.ts                       │
│             → No references → NEW CONVERSATION                               │
│                                                                              │
│     Step E: Generate new room ID                                            │
│             → roomId: "room-xyz-789"                                         │
│                                                                              │
│     Step F: Create new room                                                 │
│             File: lib/chat/createNewRoom.ts                                  │
│             ├─► Generate title: "TikTok Strategy"                           │
│             ├─► Insert room in database                                     │
│             └─► Send Telegram notification to team                          │
│                                                                              │
│     Step G: Store user message as memory (id = email_id for dedup)          │
│                                                                              │
│     Step H: Link email to memory in memory_emails table                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. GENERATE AI RESPONSE                                                     │
│     File: lib/emails/inbound/generateEmailResponse.ts                        │
│                                                                              │
│     Step A: Create AI Agent with system prompt                              │
│             File: lib/agents/generalAgent/getGeneralAgent.ts                 │
│             Uses: lib/chat/const.ts (SYSTEM_PROMPT)                          │
│             Uses: lib/prompts/getSystemPrompt.ts (dynamic context)           │
│                                                                              │
│     Step B: Get conversation history (empty for new convo)                  │
│             File: lib/emails/inbound/getEmailRoomMessages.ts                 │
│                                                                              │
│     Step C: Generate response via agent.generate()                          │
│                                                                              │
│     Step D: Add email footer with web link                                  │
│             → "Continue on Recoup: chat.recoupable.com/chat/room-xyz-789"   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  6. SEND REPLY EMAIL                                                         │
│     File: lib/emails/sendEmail.ts                                            │
│                                                                              │
│     Payload:                                                                 │
│       from: "Support <support@mail.recoupable.com>"                          │
│       to: ["manager@label.com"]                                              │
│       subject: "Re: Help with TikTok strategy"                               │
│       html: AI response + footer                                             │
│       headers: { "In-Reply-To": original_message_id }                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  7. STORE ASSISTANT RESPONSE                                                 │
│     File: lib/supabase/memories/insertMemories.ts                            │
│                                                                              │
│     Saves AI response to same room for conversation continuity              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USER RECEIVES REPLY                                   │
│                                                                              │
│  From: Support <support@mail.recoupable.com>                                 │
│  Subject: Re: Help with TikTok strategy                                      │
│  Body: "Great question! Here are 5 strategies..."                            │
│        ─────────────────────────────────────                                 │
│        Note: you can reply directly to this email.                           │
│        Or continue on Recoup: chat.recoupable.com/chat/room-xyz-789          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## User Journey 2: Reply Email (Existing Thread)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USER REPLIES TO EMAIL                                 │
│                                                                              │
│  From: manager@label.com                                                     │
│  To: support@mail.recoupable.com                                             │
│  Subject: Re: Help with TikTok strategy                                      │
│  References: <original-message-id@resend.dev>  ← Key for threading!         │
│  Body: "Can you give me specific hashtag suggestions?"                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    Steps 1-3: Same as Journey 1
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. FIND EXISTING ROOM                                                       │
│     File: lib/emails/inbound/getEmailRoomId.ts                               │
│                                                                              │
│     ├─► Parse references header                                             │
│     │   → ["<original-message-id@resend.dev>"]                               │
│     │                                                                        │
│     ├─► Look up in memory_emails table                                      │
│     │   File: lib/supabase/memory_emails/selectMemoryEmails.ts               │
│     │                                                                        │
│     └─► Found! Returns room_id: "room-xyz-789"                              │
│                                                                              │
│     → SKIP room creation (room already exists)                              │
│     → Store user message in EXISTING room                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. GENERATE AI RESPONSE WITH FULL CONTEXT                                   │
│     File: lib/emails/inbound/getEmailRoomMessages.ts                         │
│                                                                              │
│     Retrieves from memories table:                                          │
│     [                                                                        │
│       { role: "user", content: "How can I grow TikTok..." },                │
│       { role: "assistant", content: "Great question! Here are 5..." },      │
│       { role: "user", content: "Can you give me hashtag..." }               │
│     ]                                                                        │
│                                                                              │
│     AI has FULL CONTEXT → generates contextual response                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    Steps 6-7: Same as Journey 1
```

---

## User Journey 3: Email to Web Transition

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER CLICKS LINK IN EMAIL FOOTER                                            │
│                                                                              │
│  "Or continue on Recoup: chat.recoupable.com/chat/room-xyz-789"              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RECOUP-CHAT LOADS CONVERSATION                                              │
│                                                                              │
│  The web app queries the same memories table using room_id                  │
│  → User sees ENTIRE conversation history (email + web messages)             │
│                                                                              │
│  Users can continue chatting on web, and if they email again later,         │
│  those web messages will be included in the AI's context.                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## User Journey 4: Duplicate Prevention (Idempotency)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RESEND WEBHOOK SENDS SAME EMAIL TWICE                                       │
│  (network retry, webhook failure, etc.)                                      │
│                                                                              │
│  Same email_id: "email-abc-123"                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FIRST REQUEST: Processed normally                                           │
│  → Memory inserted with id: "email-abc-123"                                  │
│  → Reply sent to user                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SECOND REQUEST: Duplicate detection                                         │
│  File: lib/emails/inbound/validateNewEmailMemory.ts                          │
│                                                                              │
│  try {                                                                       │
│    await insertMemories({ id: emailId, ... });                              │
│  } catch (error) {                                                           │
│    if (error.code === "23505") {  ← PostgreSQL unique constraint            │
│      return { message: "Email already processed" };                          │
│    }                                                                         │
│  }                                                                           │
│                                                                              │
│  → NO duplicate reply sent                                                  │
│  → User doesn't get spammed                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Prompts

### Main System Prompt
**Location:** `lib/chat/const.ts`

The `SYSTEM_PROMPT` constant defines Recoup's core personality and capabilities:
- Music industry AI assistant
- Artist management, fan analysis, marketing funnels
- Platform-specific social media strategy
- Actionable, data-informed insights

### Dynamic Prompt Assembly
**Location:** `lib/prompts/getSystemPrompt.ts`

Enhances the base prompt with runtime context:
- `account_id`, `artist_account_id`, `active_account_email`
- `active_conversation_id`, `active_conversation_name`
- Image editing instructions
- User context (name, job title, company, custom instructions)
- Artist/workspace context (artist-specific instructions)
- Knowledge base content (uploaded files)

### Email Footer
**Location:** `lib/emails/inbound/generateEmailResponse.ts`

Appended to every email response:
```html
<hr />
<p>Note: you can reply directly to this email to continue the conversation.</p>
<p>Or continue the conversation on Recoup: 
  <a href="https://chat.recoupable.com/chat/${roomId}">link</a>
</p>
```

---

## Key Design Decisions

### 1. Idempotency
Uses `email_id` as the memory ID to prevent duplicate processing. If the same webhook fires twice, the database insert fails with unique constraint error (code `23505`).

### 2. Thread Continuity
Uses the email `References` header to find existing rooms. This links email replies to existing conversations.

### 3. Cross-Platform Seamlessness
Users can switch between email and web chat. Both use the same `memories` table with the same `room_id`.

### 4. Clean Input Processing
The `trimRepliedContext()` function strips quoted reply content from emails (Gmail, Outlook, Apple Mail formats) so the AI only sees new content.

### 5. Reply Threading
Uses `In-Reply-To` header in outbound emails to maintain proper threading in user's inbox.

---

## Current Limitations

1. **CC recipients do NOT receive responses** - Reply only goes to `original.from`
2. **Attachments not processed** - Webhook receives attachment metadata but they're ignored
3. **Plain text responses** - No HTML email styling (just text + footer)
4. **No rate limiting** - No protection against email spam
5. **Silent failures** - When processing fails, user gets no notification

---

## Modification Guide

| Want to change... | Modify this file |
|-------------------|------------------|
| AI personality/behavior | `lib/chat/const.ts` |
| Dynamic user context in prompt | `lib/prompts/getSystemPrompt.ts` |
| Email footer/links | `lib/emails/inbound/generateEmailResponse.ts` |
| How replies are stripped | `lib/emails/inbound/trimRepliedContext.ts` |
| Thread detection logic | `lib/emails/inbound/getEmailRoomId.ts` |
| "From" address formatting | `lib/emails/inbound/getFromWithName.ts` |
| Room creation behavior | `lib/chat/createNewRoom.ts` |
| Title generation | `lib/chat/generateChatTitle.ts` |
| Available AI tools | `lib/chat/setupToolsForRequest.ts` |
| Team notifications | `lib/telegram/sendNewConversationNotification.ts` |
| Webhook validation | `lib/emails/validateInboundEmailEvent.ts` |
| Message storage format | `lib/messages/filterMessageContentForMemories.ts` |

---

## Potential Improvements

1. **Include CC recipients in reply** - Add `cc: original.cc` to email payload
2. **Email-specific prompt section** - Add context like "responding via email, keep concise"
3. **Attachment handling** - Process and include attachments in AI context
4. **HTML email styling** - Professional email template with branding
5. **Rate limiting** - Prevent abuse from email spam
6. **Error notification emails** - Notify user when processing fails
7. **Multi-recipient handling** - Different responses for different recipients




