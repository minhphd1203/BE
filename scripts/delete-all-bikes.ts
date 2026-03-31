import { db } from '../src/db';
import { bikes, inspections, transactions, reports, messages, wishlists, reviews } from '../src/db/schema';
import { inArray } from 'drizzle-orm';

/**
 * Delete all bikes with their relations
 * This script will delete:
 * - All messages related to deleted bikes
 * - All reviews related to transactions on deleted bikes
 * - All wishlists items for deleted bikes
 * - All inspections for deleted bikes
 * - All transactions for deleted bikes
 * - All reports related to deleted bikes
 * - All bikes
 */
async function deleteAllBikes() {
  try {
    console.log('🗑️  Bắt đầu xóa tất cả bikes và các dữ liệu liên quan...\n');

    // Get all bikes first
    const allBikes = await db.query.bikes.findMany();
    if (allBikes.length === 0) {
      console.log('ℹ️  Không có bikes nào để xóa.');
      process.exit(0);
    }

    console.log(`📊 Tìm thấy ${allBikes.length} bikes để xóa\n`);

    const bikeIds = allBikes.map(b => b.id);

    // 1. Get all transactions for these bikes (needed for reviews)
    console.log('🔍 Tìm transactions liên quan...');
    const bikeTransactions = await db.query.transactions.findMany({
      where: (t, { inArray: ia }) => ia(t.bikeId, bikeIds)
    });
    const transactionIds = bikeTransactions.map(t => t.id);
    console.log(`   ✓ Tìm thấy ${bikeTransactions.length} transactions\n`);

    // 2. Delete reviews (from transactions on bikes)
    if (transactionIds.length > 0) {
      console.log('🗑️  Xóa reviews...');
      const deletedReviews = await db.delete(reviews)
        .where(inArray(reviews.transactionId, transactionIds))
        .returning();
      console.log(`   ✓ Đã xóa ${deletedReviews.length} reviews\n`);
    }

    // 3. Delete messages related to bikes
    console.log('🗑️  Xóa messages...');
    const deletedMessages = await db.delete(messages)
      .where(inArray(messages.bikeId, bikeIds))
      .returning();
    console.log(`   ✓ Đã xóa ${deletedMessages.length} messages\n`);

    // 4. Delete wishlists items for bikes
    console.log('🗑️  Xóa wishlist items...');
    const deletedWishlists = await db.delete(wishlists)
      .where(inArray(wishlists.bikeId, bikeIds))
      .returning();
    console.log(`   ✓ Đã xóa ${deletedWishlists.length} wishlist items\n`);

    // 5. Delete inspections
    console.log('🗑️  Xóa inspections...');
    const deletedInspections = await db.delete(inspections)
      .where(inArray(inspections.bikeId, bikeIds))
      .returning();
    console.log(`   ✓ Đã xóa ${deletedInspections.length} inspections\n`);

    // 6. Delete transactions
    console.log('🗑️  Xóa transactions...');
    const deletedTransactions = await db.delete(transactions)
      .where(inArray(transactions.bikeId, bikeIds))
      .returning();
    console.log(`   ✓ Đã xóa ${deletedTransactions.length} transactions\n`);

    // 7. Delete reports related to bikes
    console.log('🗑️  Xóa reports...');
    const deletedReports = await db.delete(reports)
      .where(inArray(reports.reportedBikeId, bikeIds))
      .returning();
    console.log(`   ✓ Đã xóa ${deletedReports.length} reports\n`);

    // 8. Delete bikes
    console.log('🗑️  Xóa bikes...');
    const deletedBikes = await db.delete(bikes)
      .where(inArray(bikes.id, bikeIds))
      .returning();
    console.log(`   ✓ Đã xóa ${deletedBikes.length} bikes\n`);

    // Summary
    console.log('='.repeat(60));
    console.log('✅ XÓA TẤT CẢ BIKES THÀNH CÔNG!');
    console.log('='.repeat(60));
    console.log(`📊 Tổng kết xóa:`);
    console.log(`   - Bikes: ${deletedBikes.length}`);
    console.log(`   - Transactions: ${deletedTransactions.length}`);
    console.log(`   - Inspections: ${deletedInspections.length}`);
    console.log(`   - Messages: ${deletedMessages.length}`);
    console.log(`   - Wishlist Items: ${deletedWishlists.length}`);
    console.log(`   - Reviews: ${transactionIds.length > 0 ? 'Xóa tự động khi xóa transactions' : 0}`);
    console.log(`   - Reports: ${deletedReports.length}`);
    console.log('='.repeat(60));
    console.log('\n✨ Database đã được làm sạch!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi xóa bikes:', error);
    process.exit(1);
  }
}

deleteAllBikes();
