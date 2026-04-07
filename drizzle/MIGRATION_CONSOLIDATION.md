# Migration Consolidation Guide

## Problem
Multiple duplicate migrations with same version numbers (0004, 0015, 0016, 0017) cause confusion during team setup.

## Solution
This document guides consolidation into a clean, sequential migration chain (0-20).

## Migration Mapping (Consolidated → Old)

| Final | Consolidates | Status | Contents |
|-------|---------------|--------|----------|
| 0000 | 0000_smiling_goblin_queen | ✅ KEEP | Initial schema |
| 0001 | 0001_familiar_tony_stark | ✅ KEEP | |
| 0002 | 0002_fat_ronan | ✅ KEEP | |
| 0003 | 0003_volatile_nightcrawler | ✅ KEEP | |
| 0004 | 0004_awesome_hellcat | ✅ KEEP | Best version |
| 0005 | 0005_add_reserved_status | ✅ KEEP | |
| 0006 | 0006_add_report_reasons | ✅ KEEP | |
| 0007 | 0007_add_conversation_status | ✅ KEEP | |
| 0008 | 0008_add_file_to_messages | ✅ KEEP | |
| 0009 | 0009_add_sender_role_to_messages | ✅ KEEP | |
| 0010 | 0010_add_receiver_role_to_messages | ✅ KEEP | |
| 0011 | 0011_update_users_email_role_unique | ✅ KEEP | |
| 0012 | 0012_create_conversation_threads | ✅ KEEP | |
| 0013 | 0013_add_thread_id_to_messages | ✅ KEEP | |
| 0014 | 0014_tx_address_fullname_inspection_reason | ✅ KEEP | |
| 0015 | 0015_transaction_fulfillment | ✅ KEEP | Better version |
| 0016 | 0016_split_delivery_table | ✅ KEEP | Better version |
| 0017 | 0017_thankful_pixie | ✅ KEEP | Comprehensive deliveries + payouts + bank columns |
| 0018 | 0018_cleanup_delivery_schema | ✅ KEEP | |
| 0019 | 0019_cleanup_transaction_delivery_columns | ✅ KEEP | |
| 0020 | 0020_add_delivery_id_to_transactions | ✅ KEEP | |

## Files to DELETE
- `0004_add_reserved_status.sql` (duplicate, keep awesome_hellcat)
- `0004_add_transaction_types.sql` (duplicate, keep awesome_hellcat)
- `0015_add_buyer_contact_to_transactions.sql` (duplicate, keep transaction_fulfillment)
- `0016_spotty_jackpot.sql` (duplicate, keep split_delivery_table)
- `0017_add_seller_payout.sql` (duplicate, keep thankful_pixie - it's more complete)
- `0021_add_bank_columns_to_users.sql` (redundant - already in 0017_thankful_pixie)

## Journal Update
Update `drizzle/meta/_journal.json` to track only 0-20 (21 migrations total):
- idx 0-20 should map to files 0000-0020
- No idx 21 (0021 is not needed)

## For Teammates
After pulling code:
1. Delete the duplicate files listed above
2. Update journal.json to the clean version
3. Run `npm run db:push` to verify state
4. NO migration re-runs needed (all already applied in database)
