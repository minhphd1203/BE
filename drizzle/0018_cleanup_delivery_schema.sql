-- Remove redundant fields from deliveries table
-- deliveredAt: duplicate of receiptConfirmedAt (both set to same value)
-- deliveryUpdatedAt: duplicate of standard updatedAt (auto-managed by Drizzle)

ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "delivered_at";
ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "delivery_updated_at";
