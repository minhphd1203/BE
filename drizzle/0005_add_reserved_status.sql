-- Migration: Add 'reserved' status to bikes table
-- Description: Allows bikes to have a 'reserved' status when a deposit is paid
--              but the full payment hasn't been completed yet.

-- Note: In PostgreSQL with Drizzle ORM, VARCHAR columns already support any string value.
-- This migration is for documentation purposes. The 'reserved' status is already 
-- supported by the existing VARCHAR(50) column in the bikes table.

-- Schema already supports: 'pending', 'approved', 'rejected', 'hidden', 'reserved', 'sold'
-- No database changes needed - validation is in the application layer.
