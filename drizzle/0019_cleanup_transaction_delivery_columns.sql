-- Cleanup: Remove old delivery columns from transactions table if they still exist
-- These were moved to the separate deliveries table in previous migrations
-- Using IF EXISTS for idempotency

ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_status";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_notes";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivered_at";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "receipt_confirmed_at";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "delivery_updated_at";

-- Verify: transactions table should now only have:
-- - transaction fields (id, bike_id, buyer_id, seller_id, amount, status, etc.)
-- - delivery_id FK pointing to deliveries table
-- - standard timestamps (created_at, updated_at)
