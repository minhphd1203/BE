-- Create brands table
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint

-- Create models table
CREATE TABLE "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign key from models to brands
ALTER TABLE "models" ADD CONSTRAINT "models_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- Add new columns to bikes table for brand_id and model_id
ALTER TABLE "bikes" ADD COLUMN "brand_id_new" uuid;
ALTER TABLE "bikes" ADD COLUMN "model_id_new" uuid;
--> statement-breakpoint

-- Migrate existing data: Create brands from unique brand names
INSERT INTO "brands" (name)
SELECT DISTINCT brand FROM bikes WHERE brand IS NOT NULL
ON CONFLICT (name) DO NOTHING;
--> statement-breakpoint

-- Migrate existing data: Create models from unique (brand, model) combinations
WITH brand_models AS (
  SELECT DISTINCT brand, model FROM bikes WHERE brand IS NOT NULL AND model IS NOT NULL
)
INSERT INTO "models" (brand_id, name)
SELECT b.id, bm.model
FROM brand_models bm
JOIN brands b ON b.name = bm.brand;
--> statement-breakpoint

-- Update bikes to reference brand_id and model_id
UPDATE bikes
SET brand_id_new = (SELECT id FROM brands WHERE brands.name = bikes.brand),
    model_id_new = (SELECT id FROM models WHERE models.name = bikes.model AND models.brand_id = (SELECT id FROM brands WHERE brands.name = bikes.brand))
WHERE brand IS NOT NULL AND model IS NOT NULL;
--> statement-breakpoint

-- Drop old columns
ALTER TABLE "bikes" DROP COLUMN "brand";
ALTER TABLE "bikes" DROP COLUMN "model";
--> statement-breakpoint

-- Rename new columns
ALTER TABLE "bikes" RENAME COLUMN "brand_id_new" TO "brand_id";
ALTER TABLE "bikes" RENAME COLUMN "model_id_new" TO "model_id";
--> statement-breakpoint

-- Add NOT NULL constraints
ALTER TABLE "bikes" ALTER COLUMN "brand_id" SET NOT NULL;
ALTER TABLE "bikes" ALTER COLUMN "model_id" SET NOT NULL;
--> statement-breakpoint

-- Add foreign keys
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;