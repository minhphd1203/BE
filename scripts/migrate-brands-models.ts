import { sql } from 'drizzle-orm';
import { db } from '../src/db/index';

/**
 * Migration Script: Create brands and models tables with data migration
 * This handles converting the varchar brand/model columns to UUID foreign keys
 */
async function migrateBrandsModels() {
  try {
    console.log('Starting brands/models migration...');

    // Check if brands table already exists
    const brandsCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'brands'
      )
    `);
    
    if ((brandsCheck as any)[0]?.exists) {
      console.log('✓ brands table already exists, skipping...');
      return;
    }

    console.log('Creating brands table...');
    await db.execute(sql`
      CREATE TABLE "brands" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "brands_name_unique" UNIQUE("name")
      )
    `);

    console.log('Creating models table...');
    await db.execute(sql`
      CREATE TABLE "models" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "brand_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "models_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id")
      )
    `);

    console.log('Adding temporary columns to bikes...');
    await db.execute(sql`
      ALTER TABLE "bikes" 
      ADD COLUMN "brand_id_new" uuid,
      ADD COLUMN "model_id_new" uuid
    `);

    console.log('Migrating brand data...');
    await db.execute(sql`
      INSERT INTO "brands" (name)
      SELECT DISTINCT brand FROM bikes WHERE brand IS NOT NULL
      ON CONFLICT (name) DO NOTHING
    `);

    console.log('Migrating model data...');
    await db.execute(sql`
      WITH brand_models AS (
        SELECT DISTINCT brand, model FROM bikes 
        WHERE brand IS NOT NULL AND model IS NOT NULL
      )
      INSERT INTO "models" (brand_id, name)
      SELECT b.id, bm.model
      FROM brand_models bm
      JOIN brands b ON b.name = bm.brand
      ON CONFLICT DO NOTHING
    `);

    console.log('Updating bikes references...');
    await db.execute(sql`
      UPDATE bikes
      SET 
        brand_id_new = (SELECT id FROM brands WHERE brands.name = bikes.brand),
        model_id_new = (SELECT id FROM models 
                        WHERE models.name = bikes.model 
                        AND models.brand_id = (SELECT id FROM brands WHERE brands.name = bikes.brand))
      WHERE brand IS NOT NULL AND model IS NOT NULL
    `);

    console.log('Dropping old brand/model columns...');
    await db.execute(sql`
      ALTER TABLE "bikes" 
      DROP COLUMN "brand",
      DROP COLUMN "model"
    `);

    console.log('Renaming new columns...');
    await db.execute(sql`
      ALTER TABLE "bikes" 
      RENAME COLUMN "brand_id_new" TO "brand_id";
    `);
    await db.execute(sql`
      ALTER TABLE "bikes" 
      RENAME COLUMN "model_id_new" TO "model_id"
    `);

    console.log('Adding constraints...');
    await db.execute(sql`
      ALTER TABLE "bikes" 
      ALTER COLUMN "brand_id" SET NOT NULL,
      ALTER COLUMN "model_id" SET NOT NULL,
      ADD CONSTRAINT "bikes_brand_id_brands_id_fk" 
        FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id"),
      ADD CONSTRAINT "bikes_model_id_models_id_fk" 
        FOREIGN KEY ("model_id") REFERENCES "public"."models"("id")
    `);

    console.log('✓ Migration completed successfully!');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
}

migrateBrandsModels();
