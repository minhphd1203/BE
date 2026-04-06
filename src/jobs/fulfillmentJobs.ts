import { db } from '../db';
import { transactions } from '../db/schema';
import { and, eq, lt } from 'drizzle-orm';
import {
  autoConfirmReceiptDays,
  fulfillmentJobIntervalMs,
  stalePendingTransactionDays,
} from '../constants/fulfillment';
import { confirmReceiptForSaleGroup, findDeliveredAwaitingReceiptBefore } from '../services/fulfillmentSync';

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
 * delivered quá N ngày mà buyer không xác nhận → auto receipt_confirmed_at (giống sàn TMĐT).
 */
export async function autoConfirmStaleReceipts() {
  try {
    const days = autoConfirmReceiptDays();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await findDeliveredAwaitingReceiptBefore(cutoff);
    if (rows.length === 0) {
      return;
    }

    const seen = new Set<string>();
    let groups = 0;

    for (const r of rows) {
      const key = `${r.bikeId}:${r.buyerId}:${r.sellerId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const n = await confirmReceiptForSaleGroup(r.bikeId, r.buyerId, r.sellerId);
      if (n > 0) {
        groups++;
        console.log(
          `[FulfillmentJob] Auto-confirmed receipt for bike ${r.bikeId.slice(0, 8)}... (${n} row(s), after ${days}d)`
        );
      }
    }

    if (groups > 0) {
      console.log(`[FulfillmentJob] Auto-confirmed ${groups} sale group(s)`);
    }
  } catch (e) {
    console.error('[FulfillmentJob] autoConfirmStaleReceipts:', e instanceof Error ? e.message : e);
  }
}

export function runFulfillmentJobsBatch() {
  return Promise.all([autoCancelStalePendingTransactions(), autoConfirmStaleReceipts()]);
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
