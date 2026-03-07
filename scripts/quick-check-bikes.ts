import { db } from '../src/db';
import { bikes } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function checkBikes() {
  try {
    const approvedBikes = await db
      .select()
      .from(bikes)
      .where(eq(bikes.status, 'approved'));

    console.log(`\n📊 Bikes approved: ${approvedBikes.length}`);
    
    if (approvedBikes.length > 0) {
      console.log('\n✅ First approved bike:');
      console.log(`   ID: ${approvedBikes[0].id}`);
      console.log(`   Title: ${approvedBikes[0].title}`);
      console.log(`   Status: ${approvedBikes[0].status}`);
      console.log(`   Inspection Status: ${approvedBikes[0].inspectionStatus}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBikes();
