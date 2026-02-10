import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function checkAndCreateAdmin() {
  try {
    console.log('🔍 Checking for admin user...');
    
    // Check if admin exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, 'admin@example.com'))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists!');
      console.log('Email:', existingAdmin[0].email);
      console.log('Name:', existingAdmin[0].name);
      console.log('Role:', existingAdmin[0].role);
      return;
    }

    console.log('⚠️  Admin user not found. Creating...');

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create admin user
    const newAdmin = await db.insert(users).values({
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      phone: '0123456789',
      role: 'admin'
    }).returning();

    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
    console.log('User ID:', newAdmin[0].id);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

checkAndCreateAdmin();
