import { db } from '../src/db';
import { users, bikes, categories, transactions, reports } from '../src/db/schema';

async function checkDatabase() {
  try {
    console.log('='.repeat(60));
    console.log('📊 KIỂM TRA DATABASE BESWP');
    console.log('='.repeat(60));
    console.log();

    // Kiểm tra Users
    console.log('👥 USERS TABLE:');
    const allUsers = await db.select().from(users);
    console.log(`   Tổng số users: ${allUsers.length}`);
    
    if (allUsers.length > 0) {
      console.log('\n   Chi tiết users:');
      allUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name || 'N/A'}`);
        console.log(`      - ID: ${user.id}`);
        console.log(`      - Email: ${user.email}`);
        console.log(`      - Role: ${user.role}`);
        console.log(`      - Phone: ${user.phone || 'N/A'}`);
        console.log(`      - Created: ${user.createdAt}`);
        console.log();
      });
    } else {
      console.log('   ❌ Chưa có user nào\n');
    }

    // Kiểm tra Bikes
    console.log('🚲 BIKES TABLE:');
    const allBikes = await db.select().from(bikes);
    console.log(`   Tổng số bikes: ${allBikes.length}`);
    
    if (allBikes.length > 0) {
      console.log('\n   Chi tiết bikes:');
      allBikes.forEach((bike, index) => {
        console.log(`   ${index + 1}. ${bike.title}`);
        console.log(`      - ID: ${bike.id}`);
        console.log(`      - Price: ${bike.price} VNĐ`);
        console.log(`      - Status: ${bike.status}`);
        console.log(`      - Seller ID: ${bike.sellerId}`);
        console.log();
      });
    } else {
      console.log('   ❌ Chưa có bike nào\n');
    }

    // Kiểm tra Categories
    console.log('📂 CATEGORIES TABLE:');
    const allCategories = await db.select().from(categories);
    console.log(`   Tổng số categories: ${allCategories.length}`);
    
    if (allCategories.length > 0) {
      console.log('\n   Chi tiết categories:');
      allCategories.forEach((cat, index) => {
        console.log(`   ${index + 1}. ${cat.name} (slug: ${cat.slug})`);
        console.log(`      - ID: ${cat.id}`);
        console.log(`      - Description: ${cat.description || 'N/A'}`);
        console.log();
      });
    } else {
      console.log('   ❌ Chưa có category nào\n');
    }

    // Kiểm tra Transactions
    console.log('💰 TRANSACTIONS TABLE:');
    const allTransactions = await db.select().from(transactions);
    console.log(`   Tổng số transactions: ${allTransactions.length}`);
    if (allTransactions.length === 0) {
      console.log('   ❌ Chưa có transaction nào\n');
    } else {
      console.log();
    }

    // Kiểm tra Reports
    console.log('🚨 REPORTS TABLE:');
    const allReports = await db.select().from(reports);
    console.log(`   Tổng số reports: ${allReports.length}`);
    if (allReports.length === 0) {
      console.log('   ❌ Chưa có report nào\n');
    } else {
      console.log();
    }

    console.log('='.repeat(60));
    console.log('✅ TỔNG KẾT:');
    console.log(`   - Users: ${allUsers.length}`);
    console.log(`   - Bikes: ${allBikes.length}`);
    console.log(`   - Categories: ${allCategories.length}`);
    console.log(`   - Transactions: ${allTransactions.length}`);
    console.log(`   - Reports: ${allReports.length}`);
    console.log('='.repeat(60));

    // Kiểm tra cấu trúc bảng
    console.log('\n📋 DANH SÁCH BẢNG CÓ SẴN:');
    console.log('   ✓ users');
    console.log('   ✓ bikes');
    console.log('   ✓ categories');
    console.log('   ✓ transactions');
    console.log('   ✓ reports');
    console.log();

    console.log('✅ Kết nối database thành công!');
    console.log('✅ Tất cả bảng đã được migrate!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi kiểm tra database:', error);
    process.exit(1);
  }
}

checkDatabase();
