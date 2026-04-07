import { db } from '../db';
import { transactions, deliveries } from '../db/schema';
import { and, eq, isNotNull, isNull, lt, inArray, sql } from 'drizzle-orm';
import type { DeliveryStatus } from '../constants/fulfillment';

/**
 * Gọi từ VNPay IPN khi bike vừa chuyển sang `sold`.
 * Gán preparing cho mọi giao dịch completed cùng (bike, buyer, seller) còn chưa có delivery liên kết.
 * Không ghi đè nếu seller đã bắt đầu chuyển trạng thái.
 * Creates ONE delivery record for the entire sale group (not one per transaction).
 */
export async function markFulfillmentPreparingAfterBikeSold(
  bikeId: string,
  buyerId: string,
  sellerId: string
): Promise<void> {
  try {
    // Find all completed transactions for this sale group
    const allTxns = await db.query.transactions.findMany({
      where: and(eq(transactions.bikeId, bikeId), eq(transactions.buyerId, buyerId), eq(transactions.sellerId, sellerId), eq(transactions.status, 'completed')),
      columns: {
        id: true,
        deliveryId: true,
      },
    });

    // Filter to only those WITHOUT delivery records
    const txnsWithoutDelivery = allTxns.filter((t) => !t.deliveryId);

    if (txnsWithoutDelivery.length === 0) {
      return; // No transactions to process
    }

    // Create ONE delivery record for the entire sale group
    // Use .returning() without args to return all columns
    const result = await db
      .insert(deliveries)
      .values({
        deliveryStatus: 'preparing',
      })
      .returning();

    const delivery = result?.[0];

    if (!delivery?.id) {
      return;
    }

    // Link ALL transactions in this group to the SAME delivery
    for (const txn of txnsWithoutDelivery) {
      await db.update(transactions).set({ deliveryId: delivery.id }).where(eq(transactions.id, txn.id));
    }
  } catch (e) {
    console.error('[fulfillmentSync] markFulfillmentPreparingAfterBikeSold:', e instanceof Error ? e.message : e);
  }
}

export type DeliveryPatch = {
  deliveryStatus: DeliveryStatus;
  deliveryNotes?: string | null;
};

/** 
 * Seller updates delivery status for ALL transactions in a sale group.
 * Transitions: preparing → delivering (only seller can update to these states)
 * Buyer confirmation handles: delivering → delivered (via confirmReceiptForSaleGroup)
 */
export async function applyDeliveryPatchToSaleGroup(
  patch: DeliveryPatch & { bikeId: string; buyerId: string; sellerId: string }
) {
  const { bikeId, buyerId, sellerId, deliveryStatus, deliveryNotes } = patch;

  // Get all transactions for this sale group
  const txns = await db
    .select({ id: transactions.id, deliveryId: transactions.deliveryId })
    .from(transactions)
    .where(
      and(
        eq(transactions.bikeId, bikeId),
        eq(transactions.buyerId, buyerId),
        eq(transactions.sellerId, sellerId),
        eq(transactions.status, 'completed')
      )
    );

  // Update or create delivery records (updatedAt auto-managed by Drizzle)
  for (const txn of txns) {
    if (txn.deliveryId) {
      // Update existing delivery
      await db
        .update(deliveries)
        .set({
          deliveryStatus,
          deliveryNotes: deliveryNotes !== undefined ? deliveryNotes : undefined,
        })
        .where(eq(deliveries.id, txn.deliveryId));
    } else {
      // Create new delivery
      const [newDel] = await db
        .insert(deliveries)
        .values({
          deliveryStatus,
          deliveryNotes,
        })
        .returning({ id: deliveries.id });

      if (newDel) {
        await db
          .update(transactions)
          .set({ deliveryId: newDel.id })
          .where(eq(transactions.id, txn.id));
      }
    }
  }
}

export async function confirmReceiptForSaleGroup(
  bikeId: string,
  buyerId: string,
  sellerId: string,
  confirmedAt: Date
): Promise<number> {
  const now = new Date();

  // Buyer confirms receipt: changes 'delivering' → 'delivered' + sets receiptConfirmedAt
  // This completes the fulfillment workflow for all related transactions
  const txns = await db
    .select({ deliveryId: transactions.deliveryId })
    .from(transactions)
    .innerJoin(
      deliveries,
      and(
        eq(transactions.deliveryId, deliveries.id),
        eq(deliveries.deliveryStatus, 'delivering'),
        sql`${deliveries.receiptConfirmedAt} IS NULL`
      )
    )
    .where(
      and(
        eq(transactions.bikeId, bikeId),
        eq(transactions.buyerId, buyerId),
        eq(transactions.sellerId, sellerId),
        eq(transactions.status, 'completed')
      )
    );

  // Update each delivery
  const updated = await db
    .update(deliveries)
    .set({
      deliveryStatus: 'delivered',
      receiptConfirmedAt: confirmedAt,
    })
    .where(
      and(
        sql`${deliveries.receiptConfirmedAt} IS NULL`,
        eq(deliveries.deliveryStatus, 'delivering')
      )
    )
    .returning({ id: deliveries.id });

  return updated.length;
}

/** 
 * Cho job: tìm các dòng stuck in 'delivering' status quá N ngày mà buyer chưa xác nhận.
 * Auto-confirm: 'delivering' → 'delivered' + set receiptConfirmedAt.
 */
export async function findDeliveredAwaitingReceiptBefore(cutoff: Date) {
  // Find deliveries stuck in 'delivering' status without manual confirmation (older than cutoff)
  const deliveriesToConfirm = await db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.deliveryStatus, 'delivering'),  // ← Stuck at delivering stage
        sql`${deliveries.receiptConfirmedAt} IS NULL`,        // ← No manual confirmation from buyer
        lt(deliveries.updatedAt, cutoff)              // ← Older than N days (using standard updatedAt)
      )
    );

  if (deliveriesToConfirm.length === 0) {
    return [];
  }

  // Get associated transactions
  const deliveryIds = deliveriesToConfirm.map((d) => d.id);
  return await db
    .select({
      id: transactions.id,
      bikeId: transactions.bikeId,
      buyerId: transactions.buyerId,
      sellerId: transactions.sellerId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, 'completed'),
        inArray(transactions.deliveryId, deliveryIds)
      )
    );
}
