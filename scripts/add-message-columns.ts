import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function addMessageColumns() {
  try {
    console.log('Adding message columns...');

    // Add columns to messages table
    await db.execute(
      sql`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "file_url" text`
    );
    console.log('✓ Added file_url column');

    await db.execute(
      sql`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "conversation_status" varchar(50) DEFAULT 'active' NOT NULL`
    );
    console.log('✓ Added conversation_status column');

    await db.execute(
      sql`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "conversation_closed_at" timestamp`
    );
    console.log('✓ Added conversation_closed_at column');

    await db.execute(
      sql`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "conversation_closed_by" uuid`
    );
    console.log('✓ Added conversation_closed_by column');

    // Add foreign key for conversation_closed_by if not exists
    await db.execute(
      sql`ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_closed_by_users_id_fk" 
          FOREIGN KEY ("conversation_closed_by") REFERENCES "public"."users"("id") 
          ON DELETE no action ON UPDATE no action`
    ).catch(() => {
      console.log('⚠ Foreign key constraint already exists');
    });

    console.log('✅ All message columns added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding columns:', error);
    process.exit(1);
  }
}

addMessageColumns();
