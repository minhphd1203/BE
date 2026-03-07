import { db } from '../src/db';
import { bikes, inspections, users } from '../src/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

async function testInspectorAPI() {
  try {
    console.log('🧪 Testing Inspector API logic...\n');

    // Get inspector ID
    const [inspector] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'inspector1@beswp.com'));

    if (!inspector) {
      console.error('❌ Inspector not found!');
      return;
    }

    console.log('✅ Inspector found:');
    console.log(`   ID: ${inspector.id}`);
    console.log(`   Role: ${inspector.role}\n`);

    const inspectorId = inspector.id;

    // Test 1: Count pending bikes
    console.log('📊 Test 1: Counting pending bikes...');
    const [pendingResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(bikes)
      .where(eq(bikes.inspectionStatus, 'pending'));

    console.log(`   Pending inspections: ${pendingResult.count}\n`);

    // Test 2: Count completed by this inspector
    console.log('📊 Test 2: Counting completed inspections...');
    const [completedResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(inspections)
      .where(eq(inspections.inspectorId, inspectorId));

    console.log(`   Completed inspections: ${completedResult.count}\n`);

    // Test 3: Get pending bikes list
    console.log('🔍 Test 3: Getting pending bikes...');
    const pendingBikes = await db
      .select({
        id: bikes.id,
        title: bikes.title,
        status: bikes.status,
        inspectionStatus: bikes.inspectionStatus,
      })
      .from(bikes)
      .where(
        and(
          eq(bikes.status, 'approved'),
          sql`${bikes.inspectionStatus} IN ('pending', 'in_progress')`
        )
      )
      .limit(5);

    console.log(`   Found ${pendingBikes.length} bikes:\n`);
    pendingBikes.forEach((bike, i) => {
      console.log(`   ${i + 1}. ${bike.title}`);
      console.log(`      ID: ${bike.id}`);
      console.log(`      Status: ${bike.status}`);
      console.log(`      Inspection: ${bike.inspectionStatus}\n`);
    });

    console.log('✅ All tests passed!');
    console.log('\n💡 If Postman still fails, the issue is likely:');
    console.log('   1. Token not properly set in Authorization header');
    console.log('   2. JWT_SECRET mismatch');
    console.log('   3. Server not running or crashed');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

testInspectorAPI();
