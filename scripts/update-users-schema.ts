import { db, client } from '../src/db';

async function updateUsersTable() {
  try {
    console.log('Updating users table schema...');
    
    // Drop the old unique constraint on email
    await db.execute(`
      ALTER TABLE "users" DROP CONSTRAINT "users_email_unique"
    `);
    console.log('✓ Dropped old email unique constraint');
    
    // Create composite unique index on (email, role)
    await db.execute(`
      CREATE UNIQUE INDEX "email_role_unique" ON "users" ("email", "role")
    `);
    console.log('✓ Created composite unique index on (email, role)');
    
    console.log('✓ Schema update completed successfully');
  } catch (error) {
    console.error('Error updating schema:', error);
  } finally {
    await client.end();
  }
}

updateUsersTable();
