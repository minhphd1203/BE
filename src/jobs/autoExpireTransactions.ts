import { db } from '../db';
import { transactions, bikes } from '../db/schema';
import { eq, and, inArray, lt } from 'drizzle-orm';

/**
 * Auto-expire approved transactions after 10 minutes
 * If a transaction is approved but buyer doesn't pay within 10 minutes:
 * - Cancel the transaction
 * - Unhide the bike back to 'approved' status
 * 
 * This job runs every minute (configurable)
 */
export async function autoExpireTransactions() {
  try {
    console.log('[AutoExpire] Checking for expired transactions...');

    // Calculate 10 minutes ago
    const expirationTime = new Date(Date.now() - 10 * 60 * 1000);

    // Find all approved transactions older than 10 minutes (from creation time, matching IPN logic)
    const expiredTransactions = await db.query.transactions.findMany({
      where: and(
        eq(transactions.status, 'approved'),
        lt(transactions.createdAt, expirationTime)
      ),
      columns: {
        id: true,
        bikeId: true,
        createdAt: true,
      },
    });

    if (expiredTransactions.length === 0) {
      console.log('[AutoExpire] No expired transactions found.');
      return;
    }

    console.log(`[AutoExpire] Found ${expiredTransactions.length} expired transaction(s). Processing...`);

    // Process each expired transaction
    for (const txn of expiredTransactions) {
      try {
        // Update transaction status to cancelled
        const [cancelledTxn] = await db
          .update(transactions)
          .set({
            status: 'cancelled',
            notes: `Auto-cancelled after 10-minute payment window expired at ${new Date().toISOString()}`,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, txn.id))
          .returning();

        // Unhide bike back to approved
        const [unHiddenBike] = await db
          .update(bikes)
          .set({
            status: 'approved',
            updatedAt: new Date(),
          })
          .where(eq(bikes.id, txn.bikeId))
          .returning();

        console.log(
          `[AutoExpire] ✓ Expired transaction ${txn.id.slice(0, 8)}... → Cancelled, Bike restored to approved`
        );
      } catch (err) {
        console.error(
          `[AutoExpire] ✗ Error processing transaction ${txn.id}: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    console.log(`[AutoExpire] Completed processing ${expiredTransactions.length} expired transaction(s).`);
  } catch (error) {
    console.error('[AutoExpire] Error:', error instanceof Error ? error.message : error);
  }
}

/**
 * Start the auto-expiration job
 * Runs every 60 seconds (1 minute) by default
 */
export function startAutoExpireJob(intervalMs: number = 60 * 1000) {
  console.log(`[AutoExpire] Job started. Will check every ${intervalMs / 1000} seconds.`);
  
  // Run immediately on startup
  autoExpireTransactions();

  // Then run periodically
  setInterval(autoExpireTransactions, intervalMs);
}
