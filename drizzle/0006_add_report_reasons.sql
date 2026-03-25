CREATE TABLE IF NOT EXISTS "report_reasons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL UNIQUE,
  "description" text,
  "is_system_auto_resolvable" boolean NOT NULL DEFAULT false,
  "auto_resolve_action" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Alter reports table to add new columns
ALTER TABLE "reports" 
ADD COLUMN "reason_id" uuid REFERENCES "report_reasons"("id"),
ADD COLUMN "reason_text" text,
ALTER COLUMN "reason" DROP NOT NULL;

-- Insert default violation reason (Bike Condition/Quality Issue)
INSERT INTO "report_reasons" ("id", "name", "description", "is_system_auto_resolvable", "auto_resolve_action")
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Bike Condition/Quality Issue',
  'Bike received is different from seller description - misleading info or quality defect',
  true,
  'delete_bike'
)
ON CONFLICT ("name") DO NOTHING;
