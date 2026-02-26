import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function createInspector() {
  try {
    const email = 'inspector1@beswp.com';
    const password = 'Test@123';
    const name = 'Kiểm Duyệt Viên 1';
    const phone = '0922222222';

    console.log('🔍 Kiểm tra tài khoản inspector...');
    
    // Kiểm tra xem inspector đã tồn tại chưa
    const existingInspector = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingInspector.length > 0) {
      console.log('✅ Tài khoản inspector đã tồn tại!');
      console.log('📧 Email:', existingInspector[0].email);
      console.log('👤 Name:', existingInspector[0].name);
      console.log('📞 Phone:', existingInspector[0].phone);
      console.log('🔑 Role:', existingInspector[0].role);
      console.log('🆔 ID:', existingInspector[0].id);
      return;
    }

    console.log('⚠️  Tài khoản inspector chưa tồn tại. Đang tạo...');

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo inspector user
    const newInspector = await db.insert(users).values({
      email,
      password: hashedPassword,
      name,
      phone,
      role: 'inspector'
    }).returning();

    console.log('✅ Tài khoản inspector đã được tạo thành công!');
    console.log('='.repeat(50));
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Name:', name);
    console.log('📞 Phone:', phone);
    console.log('🆔 ID:', newInspector[0].id);
    console.log('='.repeat(50));
    console.log('\n💡 Bạn có thể đăng nhập với:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}\n`);

  } catch (error) {
    console.error('❌ Lỗi khi tạo inspector:', error);
    process.exit(1);
  }

  process.exit(0);
}

createInspector();
