/**
 * Migration script: thêm các bảng mới (wishlists, messages, reviews)
 * và cột video vào bảng bikes.
 *
 * Chạy: npx ts-node scripts/migrate-new-features.ts
 */
import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('🚀 Bắt đầu migration các tính năng mới...\n');

  try {
    // 1. Thêm cột video vào bảng bikes (nếu chưa có)
    console.log('📝 Thêm cột video vào bảng bikes...');
    await db.execute(sql`
      ALTER TABLE bikes
      ADD COLUMN IF NOT EXISTS video TEXT;
    `);
    console.log('   ✅ Cột video đã được thêm (hoặc đã tồn tại)\n');

    // 2. Tạo bảng wishlists
    console.log('📝 Tạo bảng wishlists...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS wishlists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bike_id UUID NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, bike_id)
      );
    `);
    console.log('   ✅ Bảng wishlists đã được tạo\n');

    // 3. Tạo bảng messages
    console.log('📝 Tạo bảng messages...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id),
        receiver_id UUID NOT NULL REFERENCES users(id),
        bike_id UUID REFERENCES bikes(id),
        content TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('   ✅ Bảng messages đã được tạo\n');

    // 4. Tạo bảng reviews
    console.log('📝 Tạo bảng reviews...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reviewer_id UUID NOT NULL REFERENCES users(id),
        seller_id UUID NOT NULL REFERENCES users(id),
        transaction_id UUID REFERENCES transactions(id),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('   ✅ Bảng reviews đã được tạo\n');

    // 5. Tạo indexes để tối ưu query
    console.log('📝 Tạo indexes...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);
      CREATE INDEX IF NOT EXISTS idx_wishlists_bike_id ON wishlists(bike_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
      CREATE INDEX IF NOT EXISTS idx_messages_bike_id ON messages(bike_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON reviews(seller_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id);
      CREATE INDEX IF NOT EXISTS idx_bikes_seller_id ON bikes(seller_id);
      CREATE INDEX IF NOT EXISTS idx_bikes_status ON bikes(status);
    `);
    console.log('   ✅ Indexes đã được tạo\n');

    console.log('🎉 Migration hoàn tất thành công!');
    console.log('\nCác bảng đã được tạo/cập nhật:');
    console.log('  - bikes.video (cột mới)');
    console.log('  - wishlists (bảng mới)');
    console.log('  - messages (bảng mới)');
    console.log('  - reviews (bảng mới)');
  } catch (error) {
    console.error('❌ Migration thất bại:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
