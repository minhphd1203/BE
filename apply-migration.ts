import * as dotenv from 'dotenv';
import { client } from './src/db';

dotenv.config();

async function createTables() {
  try {
    console.log('Creating brands and models tables...\n');
    
    // Create brands table
    console.log('Creating brands table...');
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "brands" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "brands_name_unique" UNIQUE("name")
      );
    `);
    console.log('✅ Brands table created\n');
    
    // Create models table
    console.log('Creating models table...');
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS "models" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "brand_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✅ Models table created\n');
    
    // Add foreign key from models to brands
    console.log('Adding foreign key from models to brands...');
    try {
      await client.unsafe(`
        ALTER TABLE "models" ADD CONSTRAINT "models_brand_id_brands_id_fk" 
        FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
      `);
      console.log('✅ Foreign key added\n');
    } catch (err: any) {
      console.log('⚠️  Foreign key already exists\n');
    }
    
    // Add new columns to bikes table if they don't exist
    console.log('Adding brand_id and model_id columns to bikes table...');
    try {
      await client.unsafe(`ALTER TABLE "bikes" ADD COLUMN IF NOT EXISTS "brand_id" uuid;`);
      console.log('✅ Added brand_id column');
    } catch (err: any) {
      console.log('⚠️  brand_id column likely already exists');
    }
    
    try {
      await client.unsafe(`ALTER TABLE "bikes" ADD COLUMN IF NOT EXISTS "model_id" uuid;`);
      console.log('✅ Added model_id column\n');
    } catch (err: any) {
      console.log('⚠️  model_id column likely already exists\n');
    }
    
    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTables();
