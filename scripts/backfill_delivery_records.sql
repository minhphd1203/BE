-- =============================================================================
-- Backfill missing delivery records for old completed transactions
-- Run this script once to initialize delivery records for transactions that
-- were completed before the fulfillment system was implemented.
-- =============================================================================

-- Step 1: Create delivery records for all completed transactions without deliveries
INSERT INTO deliveries (delivery_status, created_at, updated_at)
SELECT 
  'preparing',
  t.created_at,
  t.updated_at
FROM transactions t
WHERE 
  t.status = 'completed' 
  AND t.delivery_id IS NULL;

-- Step 2: Check how many were created
SELECT COUNT(*) as delivery_records_created FROM deliveries 
WHERE delivery_status = 'preparing' AND created_at >= NOW() - INTERVAL '5 minutes';

-- Step 3: Link delivery records to transactions (use delivery IDs from step 1)
UPDATE transactions t
SET delivery_id = d.id
FROM deliveries d
WHERE 
  t.status = 'completed'
  AND t.delivery_id IS NULL
  AND d.delivery_status = 'preparing'
  AND d.created_at >= t.created_at - INTERVAL '1 second'
  AND d.created_at <= t.created_at + INTERVAL '1 second';

-- Step 4: Verify the backfill
SELECT 
  COUNT(*) as total_completed_txns,
  COUNT(CASE WHEN delivery_id IS NOT NULL THEN 1 END) as with_delivery_records,
  COUNT(CASE WHEN delivery_id IS NULL THEN 1 END) as without_delivery_records
FROM transactions
WHERE status = 'completed';

-- After running this script, all old completed transactions should have delivery records
-- New transactions going forward will have delivery records created automatically
