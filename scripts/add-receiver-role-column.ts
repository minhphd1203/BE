import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function addReceiverRoleColumn() {
  try {
    console.log('Adding receiver_role column to messages table...');
    await db.execute(
      sql.raw(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS receiver_role VARCHAR(50) NOT NULL DEFAULT 'seller'`)
    );
    console.log('✅ receiver_role column added successfully');
    
    console.log('Creating index on receiver_role...');
    await db.execute(
      sql.raw(`CREATE INDEX IF NOT EXISTS idx_messages_receiver_role ON messages(receiver_role)`)
    );
    console.log('✅ Index created successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding column:', error);
    process.exit(1);
  }
}

addReceiverRoleColumn();
