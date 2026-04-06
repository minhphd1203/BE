import { db } from '../db';
import { transactions } from '../db/schema';
import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import type { DeliveryStatus } from '../constants/fulfillment';

/**
 * Gọi từ VNPay IPN khi bike vừa chuyển sang `sold`.
 * Gán preparing cho mọi giao dịch completed cùng (bike, buyer, seller) còn chưa có delivery_status.
 * Không ghi đè nếu seller đã bắt đầu chuyển trạng thái.
 */
export async function markFulfillmentPreparingAfterBikeSold(
  bikeId: string,
  buyerId: string,
  sellerId: string
): Promise<void> {
  const now = new Date();
  await db
    .update(transactions)
    .set({
      deliveryStatus: 'preparing',
      deliveryUpdatedAt: now,
    })
    .where(
      and(
        eq(transactions.bikeId, bikeId),
        eq(transactions.buyerId, buyerId),
        eq(transactions.sellerId, sellerId),
        eq(transactions.status, 'completed'),
        isNull(transactions.deliveryStatus)
      )
    );
}

export type DeliveryPatch = {
  deliveryStatus: DeliveryStatus;
  deliveryNotes?: string | null;
  deliveredAt?: Date | null;
  deliveryUpdatedAt: Date;
};

/** Cập nhật đồng bộ mọi transaction completed cùng đơn bán (cọc + thanh toán còn lại). */
export async function applyDeliveryPatchToSaleGroup(
  patch: DeliveryPatch & { bikeId: string; buyerId: string; sellerId: string }
) {
  const { bikeId, buyerId, sellerId, deliveryStatus, deliveryNotes, deliveredAt, deliveryUpdatedAt } = patch;
  const setPayload: {
    deliveryStatus: DeliveryStatus;
    deliveryUpdatedAt: Date;
    deliveryNotes?: string | null;
    deliveredAt?: Date | null;
  } = {
    deliveryStatus,
    deliveryUpdatedAt,
  };
  if (deliveryNotes !== undefined) {
    setPayload.deliveryNotes = deliveryNotes;
  }
  if (deliveredAt !== undefined) {
    setPayload.deliveredAt = deliveredAt;
  }
  await db
    .update(transactions)
    .set(setPayload)
    .where(
      and(
        eq(transactions.bikeId, bikeId),
        eq(transactions.buyerId, buyerId),
        eq(transactions.sellerId, sellerId),
        eq(transactions.status, 'completed')
      )
    );
}

export async function confirmReceiptForSaleGroup(bikeId: string, buyerId: string, sellerId: string): Promise<number> {
  const now = new Date();
  const result = await db
    .update(transactions)
    .set({
      receiptConfirmedAt: now,
      deliveryUpdatedAt: now,
    })
    .where(
      and(
        eq(transactions.bikeId, bikeId),
        eq(transactions.buyerId, buyerId),
        eq(transactions.sellerId, sellerId),
        eq(transactions.status, 'completed'),
        eq(transactions.deliveryStatus, 'delivered'),
        isNull(transactions.receiptConfirmedAt)
      )
    )
    .returning({ id: transactions.id });
  return result.length;
}

/** Cho job: các dòng đủ điều kiện auto xác nhận đã nhận hàng. */
export async function findDeliveredAwaitingReceiptBefore(cutoff: Date) {
  return db.query.transactions.findMany({
    where: and(
      eq(transactions.status, 'completed'),
      eq(transactions.deliveryStatus, 'delivered'),
      isNull(transactions.receiptConfirmedAt),
      isNotNull(transactions.deliveredAt),
      lt(transactions.deliveredAt, cutoff)
    ),
    columns: {
      id: true,
      bikeId: true,
      buyerId: true,
      sellerId: true,
    },
  });
}
