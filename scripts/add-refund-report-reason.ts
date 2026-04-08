/**
 * Add new report reason for auto-refund violations
 * This allows buyers to report fraudulent listings and request refund
 * When admin approves this report, FE will call existing refund API
 * 
 * Run: npx ts-node scripts/add-refund-report-reason.ts
 */
import { db } from '../src/db';
import { reportReasons } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function addRefundReportReason() {
  try {
    console.log('🚀 Adding refund violation report reason...\n');

    // Check if reason already exists
    const existingReason = await db.query.reportReasons.findFirst({
      where: eq(reportReasons.name, 'Fraudulent Listing - Buyer Demands Refund'),
    });

    if (existingReason) {
      console.log('✅ Report reason already exists:', existingReason.name);
      return;
    }

    // Insert new report reason
    const [newReason] = await db
      .insert(reportReasons)
      .values({
        name: 'Fraudulent Listing - Buyer Demands Refund',
        description: 'Report a fraudulent or problematic listing. When admin approves, buyer can request refund for this transaction.',
        isSystemAutoResolvable: true,
        autoResolveAction: 'refund', // Marker for FE: when report is resolved with this reason, FE should call refund API
      })
      .returning();

    console.log('✅ New report reason created:');
    console.log('   ID:', newReason.id);
    console.log('   Name:', newReason.name);
    console.log('   Auto-resolve action:', newReason.autoResolveAction);
    console.log('\n📋 How it works:');
    console.log('   1. Buyer submits report with this reason (only shows if they placed order)');
    console.log('   2. Admin reviews and approves the report in dashboard');
    console.log('   3. Backend updates report status to "resolved"');
    console.log('   4. Frontend receives that report reason has autoResolveAction = "refund"');
    console.log('   5. Frontend calls existing /api/payment/v1/refund endpoint directly');
    console.log('   6. Refund provider (VNPay/mock) processes and webhooks status back\n');

  } catch (error) {
    console.error('❌ Error adding report reason:', error);
    process.exit(1);
  }
}

addRefundReportReason().then(() => {
  console.log('✨ Done');
  process.exit(0);
});
