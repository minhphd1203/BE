-- Create brands table
CREATE TABLE IF NOT EXISTS "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint

-- Create models table
CREATE TABLE IF NOT EXISTS "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign key from models to brands
DO $$ BEGIN
  ALTER TABLE "models" ADD CONSTRAINT "models_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Data migration: only run if old text columns still exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bikes' AND column_name = 'brand' AND data_type = 'character varying') THEN
    ALTER TABLE "bikes" ADD COLUMN IF NOT EXISTS "brand_id_new" uuid;
    ALTER TABLE "bikes" ADD COLUMN IF NOT EXISTS "model_id_new" uuid;

    INSERT INTO "brands" (name)
    SELECT DISTINCT brand FROM bikes WHERE brand IS NOT NULL
    ON CONFLICT (name) DO NOTHING;

    INSERT INTO "models" (brand_id, name)
    SELECT DISTINCT b.id, bikes.model
    FROM bikes
    JOIN brands b ON b.name = bikes.brand
    WHERE bikes.brand IS NOT NULL AND bikes.model IS NOT NULL
    ON CONFLICT DO NOTHING;

    UPDATE bikes
    SET brand_id_new = (SELECT id FROM brands WHERE brands.name = bikes.brand),
        model_id_new = (SELECT id FROM models WHERE models.name = bikes.model AND models.brand_id = (SELECT id FROM brands WHERE brands.name = bikes.brand))
    WHERE brand IS NOT NULL AND model IS NOT NULL;

    ALTER TABLE "bikes" DROP COLUMN IF EXISTS "brand";
    ALTER TABLE "bikes" DROP COLUMN IF EXISTS "model";
    ALTER TABLE "bikes" RENAME COLUMN "brand_id_new" TO "brand_id";
    ALTER TABLE "bikes" RENAME COLUMN "model_id_new" TO "model_id";

    ALTER TABLE "bikes" ALTER COLUMN "brand_id" SET NOT NULL;
    ALTER TABLE "bikes" ALTER COLUMN "model_id" SET NOT NULL;
  END IF;
END $$;
--> statement-breakpoint

-- Add foreign keys
DO $$ BEGIN
  ALTER TABLE "bikes" ADD CONSTRAINT "bikes_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "bikes" ADD CONSTRAINT "bikes_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
