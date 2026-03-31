import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function addSenderRoleColumn() {
  try {
    console.log('Adding sender_role column to messages table...');
    await db.execute(
      sql.raw(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_role VARCHAR(50) NOT NULL DEFAULT 'buyer'`)
    );
    console.log('✅ sender_role column added successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding column:', error);
    process.exit(1);
  }
}

addSenderRoleColumn();
