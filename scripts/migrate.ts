import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from '../src/db';

async function runMigration() {
  try {
    console.log('Running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✓ Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
  } finally {
    await client.end();
  }
}

runMigration();
