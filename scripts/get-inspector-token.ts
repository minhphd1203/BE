import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

async function getInspectorToken() {
  try {
    console.log('🔐 Generating Inspector Token...\n');

    // Get inspector
    const [inspector] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'inspector1@beswp.com'));

    if (!inspector) {
      console.error('❌ Inspector not found!');
      console.error('Run: npx ts-node scripts/create-inspector.ts');
      process.exit(1);
    }

    // Verify password
    const isValid = await bcrypt.compare('Test@123', inspector.password);
    
    if (!isValid) {
      console.error('❌ Password incorrect!');
      process.exit(1);
    }

    console.log('✅ Inspector found:');
    console.log(`   Email: ${inspector.email}`);
    console.log(`   Name: ${inspector.name}`);
    console.log(`   Role: ${inspector.role}`);
    console.log(`   ID: ${inspector.id}\n`);

    // Generate JWT token
    const jwtPayload = {
      userId: inspector.id,
      email: inspector.email,
      role: inspector.role,
    };

    const token = jwt.sign(jwtPayload, process.env.JWT_SECRET as string, {
      expiresIn: '24h',
    });

    console.log('🎫 JWT TOKEN (Copy this):');
    console.log('='.repeat(80));
    console.log(token);
    console.log('='.repeat(80));
    console.log('\n📋 How to use in Postman:');
    console.log('1. Open any Inspector API request');
    console.log('2. Go to Authorization tab');
    console.log('3. Type: Bearer Token');
    console.log('4. Paste the token above');
    console.log('5. Click Send\n');

    // Decode to verify
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    console.log('✅ Token decoded successfully:');
    console.log(`   User ID: ${decoded.userId}`);
    console.log(`   Email: ${decoded.email}`);
    console.log(`   Role: ${decoded.role}`);
    console.log(`   Expires: ${new Date(decoded.exp * 1000).toLocaleString()}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

getInspectorToken();
