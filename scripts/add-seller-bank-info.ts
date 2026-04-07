import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function addBankInfoToSeller() {
  try {
    // Find a seller user (the one from your test)
    const sellerId = '3aa54b63-1ed1-40e6-a32b-3e4a5bd31c20';
    
    console.log(`💰 Adding bank info to seller ${sellerId}...`);
    
    const updated = await db
      .update(users)
      .set({
        bankAccountNumber: '1234567890',
        bankAccountHolder: 'Nguyễn Văn A',
        bankCode: 'VCB',
        bankBranch: 'Chi nhánh Hà Nội',
      })
      .where(eq(users.id, sellerId))
      .returning();

    if (updated.length > 0) {
      console.log('✅ Bank info updated successfully!');
      console.log('User:', {
        id: updated[0].id,
        email: updated[0].email,
        name: updated[0].name,
        bankAccountNumber: updated[0].bankAccountNumber,
        bankAccountHolder: updated[0].bankAccountHolder,
        bankCode: updated[0].bankCode,
        bankBranch: updated[0].bankBranch,
      });
    } else {
      console.log('❌ Seller not found');
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

addBankInfoToSeller();
