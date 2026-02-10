import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Running migration for new tables...');
  
  try {
    // Create categories table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "slug" varchar(100) NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "categories_name_unique" UNIQUE("name"),
        CONSTRAINT "categories_slug_unique" UNIQUE("slug")
      );
    `);
    console.log('✓ Categories table created');

    // Create transactions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "bike_id" uuid NOT NULL,
        "buyer_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        "amount" double precision NOT NULL,
        "status" varchar(50) DEFAULT 'pending' NOT NULL,
        "payment_method" varchar(50),
        "notes" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✓ Transactions table created');

    // Create reports table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "reports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "reporter_id" uuid NOT NULL,
        "reported_user_id" uuid,
        "reported_bike_id" uuid,
        "reason" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "status" varchar(50) DEFAULT 'pending' NOT NULL,
        "resolution" text,
        "resolved_by" uuid,
        "resolved_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✓ Reports table created');

    // Add foreign keys to transactions
    await db.execute(sql`
      ALTER TABLE "transactions" 
      ADD CONSTRAINT "transactions_bike_id_bikes_id_fk" 
      FOREIGN KEY ("bike_id") REFERENCES "bikes"("id") ON DELETE cascade;
    `);
    await db.execute(sql`
      ALTER TABLE "transactions" 
      ADD CONSTRAINT "transactions_buyer_id_users_id_fk" 
      FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE cascade;
    `);
    await db.execute(sql`
      ALTER TABLE "transactions" 
      ADD CONSTRAINT "transactions_seller_id_users_id_fk" 
      FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE cascade;
    `);
    console.log('✓ Transactions foreign keys added');

    // Add foreign keys to reports
    await db.execute(sql`
      ALTER TABLE "reports" 
      ADD CONSTRAINT "reports_reporter_id_users_id_fk" 
      FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE cascade;
    `);
    await db.execute(sql`
      ALTER TABLE "reports" 
      ADD CONSTRAINT "reports_reported_user_id_users_id_fk" 
      FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE cascade;
    `);
    await db.execute(sql`
      ALTER TABLE "reports" 
      ADD CONSTRAINT "reports_reported_bike_id_bikes_id_fk" 
      FOREIGN KEY ("reported_bike_id") REFERENCES "bikes"("id") ON DELETE cascade;
    `);
    await db.execute(sql`
      ALTER TABLE "reports" 
      ADD CONSTRAINT "reports_resolved_by_users_id_fk" 
      FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE set null;
    `);
    console.log('✓ Reports foreign keys added');

    // Add category_id to bikes table if not exists
    await db.execute(sql`
      ALTER TABLE "bikes" 
      ADD COLUMN IF NOT EXISTS "category_id" uuid;
    `);
    await db.execute(sql`
      ALTER TABLE "bikes" 
      ADD CONSTRAINT "bikes_category_id_categories_id_fk" 
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE set null;
    `);
    console.log('✓ Bikes category_id column added');

    // Update bikes status default to pending
    await db.execute(sql`
      ALTER TABLE "bikes" 
      ALTER COLUMN "status" SET DEFAULT 'pending';
    `);
    console.log('✓ Bikes status default updated');

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
