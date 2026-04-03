ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "reason" text;
