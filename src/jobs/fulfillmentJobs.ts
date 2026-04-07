import { db } from '../db';
import { transactions } from '../db/schema';
import { and, eq, lt } from 'drizzle-orm';
import {
  autoConfirmReceiptDays,
  fulfillmentJobIntervalMs,
  stalePendingTransactionDays,
} from '../constants/fulfillment';
import { confirmReceiptForSaleGroup, findDeliveredAwaitingReceiptBefore, markFulfillmentPreparingAfterBikeSold } from '../services/fulfillmentSync';

/**
 * Đơn pending quá lâu không được seller phản hồi → hủy (xe vẫn approved — chưa hidden).
 * Không đụng approved/completed (đã có job 10 phút cho approved chưa trả tiền).
 */
export async function autoCancelStalePendingTransactions() {
  try {
    const days = stalePendingTransactionDays();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const stale = await db.query.transactions.findMany({
      where: and(eq(transactions.status, 'pending'), lt(transactions.createdAt, cutoff)),
      columns: { id: true, bikeId: true },
    });

    if (stale.length === 0) {
      return;
    }

    console.log(`[FulfillmentJob] Auto-cancel ${stale.length} stale pending transaction(s) (>${days}d)`);

    for (const txn of stale) {
      try {
        await db
          .update(transactions)
          .set({
            status: 'cancelled',
            notes: `Auto-cancelled: pending over ${days} days without seller action (${new Date().toISOString()})`,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, txn.id));
        console.log(`[FulfillmentJob] ✓ Cancelled pending ${txn.id.slice(0, 8)}...`);
      } catch (e) {
        console.error(`[FulfillmentJob] ✗ pending cancel ${txn.id}:`, e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error('[FulfillmentJob] autoCancelStalePendingTransactions:', e instanceof Error ? e.message : e);
  }
}

/**
 * Bikeे stuck in 'delivering' quा N ngày mà buyer không xác nhận → auto confirm (delivering -> delivered + receiptConfirmedAt).
 * Giống e-commerce marketplace (tự động xác nhận nếu quên xác nhận quá lâu).
 * 
 * After auto-confirm, seller can initiate payout via POST /api/payout/v1/create/:transactionId
 * (payout triggered manually, not auto - seller decides when to withdraw)
 */
export async function autoConfirmStaleReceipts() {
  try {
    const days = autoConfirmReceiptDays();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Query: Find deliveries stuck in 'delivering' for N+ days without manual confirmation
    const rows = await findDeliveredAwaitingReceiptBefore(cutoff);
    
    // Defensive check - ensure rows exist and have data
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return;
    }

    const seen = new Set<string>();
    let groups = 0;
    const now = new Date();

    // Process each stuck delivery (deduplicate by sale group key)
    for (const r of rows) {
      // Defensive checks - ensure all required fields exist
      if (!r) {
        console.warn('[FulfillmentJob] Skipping empty row');
        continue;
      }

      const { bikeId, buyerId, sellerId } = r;
      
      if (!bikeId || !buyerId || !sellerId) {
        console.warn('[FulfillmentJob] Skipping row with missing IDs:', { bikeId, buyerId, sellerId });
        continue;
      }

      const key = `${bikeId}:${buyerId}:${sellerId}`;
      if (seen.has(key)) continue; // Skip if already processed in this batch
      seen.add(key);

      try {
        // Auto-confirm: transitions 'delivering' → 'delivered' + sets receiptConfirmedAt
        const n = await confirmReceiptForSaleGroup(bikeId, buyerId, sellerId, now);
        if (n > 0) {
          groups++;
          console.log(
            `[FulfillmentJob] Auto-confirmed receipt for bike ${bikeId.slice(0, 8)}... (${n} row(s), after ${days}d)`
          );
        }
      } catch (e) {
        console.error(`[FulfillmentJob] Failed to auto-confirm (${bikeId}):`, e instanceof Error ? e.message : e);
      }
    }

    if (groups > 0) {
      console.log(`[FulfillmentJob] Auto-confirmed ${groups} sale group(s) - Ready for payout initiation`);
    }
  } catch (e) {
    console.error('[FulfillmentJob] autoConfirmStaleReceipts:', e instanceof Error ? e.message : e);
  }
}

/**
 * Backfill: Create delivery records for old completed transactions.
 * 
 * NOTE: Disabled due to Drizzle insert/returning issues.
 * For old transactions, run the SQL script instead:
 * scripts/backfill_delivery_records.sql
 * 
 * New transactions will have delivery records created automatically
 * by markFulfillmentPreparingAfterBikeSold() when payment completes.
 */
export async function backfillMissingDeliveryRecords() {
  // Disabled - use SQL script for one-time backfill
  return;
}

/**
 * Auto-check: Find completed transactions without delivery records and create them.
 * NOTE: Disabled due to Drizzle column reference issues.
 * The backend works fine without this - delivery records are created when payments complete.
 */
export async function autoCreateMissingDeliveryRecords() {
  // Disabled - Drizzle cache issues with column references
  return;
}

export function runFulfillmentJobsBatch() {
  return Promise.all([autoCancelStalePendingTransactions()]);
  // autoConfirmStaleReceipts() - disabled (Drizzle issue)
  // autoCreateMissingDeliveryRecords() - disabled (Drizzle cache issue)
}

/** Chạy định kỳ: hủy pending quá hạn, auto xác nhận nhận hàng sau delivered. */
export function startFulfillmentJobs(intervalMs: number = fulfillmentJobIntervalMs()) {
  console.log(`[FulfillmentJob] Scheduled every ${intervalMs / 1000}s`);
  runFulfillmentJobsBatch().catch(() => {});
  setInterval(() => {
    runFulfillmentJobsBatch().catch((e) =>
      console.error('[FulfillmentJob] batch error', e instanceof Error ? e.message : e)
    );
  }, intervalMs);
}
