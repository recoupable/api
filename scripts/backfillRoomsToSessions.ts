/**
 * Phase 2 backfill: migrate rooms + memories → sessions + chats + chat_messages.
 *
 * Real run:
 *   SUPABASE_URL=… SUPABASE_KEY=… pnpm backfill:rooms-to-sessions
 *
 * Dry run (reads only, no writes — prints what would happen):
 *   SUPABASE_URL=… SUPABASE_KEY=… DRY_RUN=1 pnpm backfill:rooms-to-sessions
 *   (or pass `--dry-run`)
 *
 * Idempotent: deterministic session ids + existence guards + write-once
 * message upserts make re-runs safe after a partial failure.
 */

import { selectAllRooms } from "@/lib/supabase/rooms/selectAllRooms";
import { migrateRoom, OVERSIZED_THRESHOLD } from "./backfill/migrateRoom";

const dryRun = process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";

async function main() {
  console.log(
    `🚀 Phase 2 backfill: rooms → sessions/chats/chat_messages${dryRun ? " [DRY RUN — no writes]" : ""}\n`,
  );

  const rooms = await selectAllRooms();
  console.log(`Found ${rooms.length} rooms to process\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  let sessionsNew = 0;
  let sessionsExisting = 0;
  let chatsNew = 0;
  let chatsExisting = 0;
  let messages = 0;
  let malformed = 0;
  let oversized = 0;

  for (const room of rooms) {
    try {
      const stats = await migrateRoom(room, { dryRun });
      if (stats.status === "skipped") {
        skipped++;
        continue;
      }
      migrated++;
      if (stats.sessionExisted) sessionsExisting++;
      else sessionsNew++;
      if (stats.chatExisted) chatsExisting++;
      else chatsNew++;
      messages += stats.messagesWritten;
      malformed += stats.messagesMalformed;
      if (stats.memoryCount >= OVERSIZED_THRESHOLD) oversized++;
    } catch (err) {
      console.error(`❌ Failed to migrate room ${room.id}:`, err);
      failed++;
    }
  }

  console.log(`\n📊 ${dryRun ? "DRY RUN — no writes performed" : "Done"}`);
  console.log(
    `Rooms:    ${migrated} ${dryRun ? "would migrate" : "migrated"}, ${skipped} skipped (no account_id), ${failed} failed`,
  );
  console.log(`Sessions: ${sessionsNew} new, ${sessionsExisting} already exist`);
  console.log(`Chats:    ${chatsNew} new, ${chatsExisting} already exist`);
  console.log(
    `Messages: ${messages} ${dryRun ? "would write" : "written"}` +
      (malformed ? ` | ${malformed} malformed (null parts) skipped` : "") +
      (oversized ? ` | ${oversized} room(s) ≥${OVERSIZED_THRESHOLD} memories` : ""),
  );

  if (failed > 0) process.exit(1);
}

main();
