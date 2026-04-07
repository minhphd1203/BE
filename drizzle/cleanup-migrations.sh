#!/bin/bash

# Migration Cleanup Script for Team Setup
# Run this after pulling the latest code to remove duplicate migrations

cd "$(dirname "$0")" || exit

echo "🧹 Cleaning up duplicate migrations..."

# Remove duplicate migration files
DUPLICATES=(
  "0004_add_reserved_status.sql"
  "0004_add_transaction_types.sql"
  "0015_add_buyer_contact_to_transactions.sql"
  "0016_spotty_jackpot.sql"
  "0017_add_seller_payout.sql"
  "0021_add_bank_columns_to_users.sql"
)

for file in "${DUPLICATES[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "✅ Deleted $file"
  fi
done

echo ""
echo "✅ Migration cleanup complete!"
echo ""
echo "📚 Kept migrations:"
echo "   - 0000_smiling_goblin_queen.sql"
echo "   - 0001_familiar_tony_stark.sql"
echo "   - ... (through)"
echo "   - 0020_add_delivery_id_to_transactions.sql"
echo ""
echo "🚀 Next steps:"
echo "   1. Run: npm run db:push"
echo "   2. Verify: npm run db:migrate (should show no new migrations)"
