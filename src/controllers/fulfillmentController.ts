import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, transactions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { updateDeliveryStatusSchema } from '../validators/transactionValidator';
import type { DeliveryStatus } from '../constants/fulfillment';
import { applyDeliveryPatchToSaleGroup, confirmReceiptForSaleGroup } from '../services/fulfillmentSync';
import { withShippingAddressAlias } from '../utils/transactionResponse';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertDeliveryTransition(
  current: string | null | undefined,
  next: DeliveryStatus,
  bikeStatus: string
): { ok: true } | { ok: false; message: string } {
  if (bikeStatus !== 'sold') {
    return {
      ok: false,
      message: 'Chỉ khi xe ở trạng thái sold (đã thanh toán đủ) mới được cập nhật giao hàng.',
    };
  }
  if (next === 'preparing') {
    if (current !== null && current !== undefined && current !== 'preparing') {
      return { ok: false, message: 'Không thể đặt lại preparing khi đã chuyển bước sau.' };
    }
    return { ok: true };
  }
  if (current === null || current === undefined) {
    return {
      ok: false,
      message: 'Đơn chưa vào luồng giao hàng. Chờ thanh toán đủ hoặc liên hệ hỗ trợ (delivery_status trống).',
    };
  }
  if (current === next) {
    return { ok: true };
  }
  if (next === 'delivering' && current !== 'preparing') {
    return { ok: false, message: 'Chỉ chuyển delivering từ preparing.' };
  }
  if (next === 'delivered' && current !== 'delivering') {
    return { ok: false, message: 'Chỉ chuyển delivered từ delivering.' };
  }
  if (next === 'preparing') {
    return { ok: false, message: 'Không thể quay lại preparing.' };
  }
  return { ok: true };
}

/**
 * PATCH /api/fulfillment/v1/transactions/:id/delivery
 * Seller: chuyển preparing → delivering → delivered (đồng bộ mọi transaction cùng đơn bán).
 */
export const updateDeliveryStatus = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user!.userId;
    const id = req.params.id as string;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ' });
    }

    const parsed = updateDeliveryStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: parsed.error.flatten(),
      });
    }
    const { status: nextStatus, deliveryNotes } = parsed.data;

    const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }
    if (row.sellerId !== sellerId) {
      return res.status(403).json({ success: false, message: 'Bạn không phải seller của đơn này' });
    }
    if (row.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Chỉ giao dịch đã thanh toán xong (completed) mới có giao hàng. Hiện tại: ${row.status}`,
      });
    }

    const [bike] = await db.select().from(bikes).where(eq(bikes.id, row.bikeId)).limit(1);
    if (!bike) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
    }

    const check = assertDeliveryTransition(row.deliveryStatus, nextStatus, bike.status);
    if (!check.ok) {
      return res.status(400).json({ success: false, message: check.message });
    }

    if (row.receiptConfirmedAt) {
      return res.status(400).json({
        success: false,
        message: 'Người mua đã xác nhận nhận hàng — không đổi trạng thái giao hàng.',
      });
    }

    const now = new Date();
    const deliveredAtToSet =
      nextStatus !== 'delivered' ? null : (row.deliveredAt ?? now);

    await applyDeliveryPatchToSaleGroup({
      bikeId: row.bikeId,
      buyerId: row.buyerId,
      sellerId: row.sellerId,
      deliveryStatus: nextStatus,
      deliveryNotes: deliveryNotes !== undefined ? deliveryNotes : undefined,
      deliveredAt: deliveredAtToSet,
      deliveryUpdatedAt: now,
    });

    const [updated] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);

    return res.status(200).json({
      success: true,
      data: withShippingAddressAlias(updated!),
      message: 'Đã cập nhật trạng thái giao hàng (đồng bộ toàn bộ giao dịch liên quan).',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật giao hàng',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/fulfillment/v1/transactions/:id/confirm-receipt
 * Buyer: xác nhận đã nhận hàng sau delivered.
 */
export const confirmReceipt = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const id = req.params.id as string;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ' });
    }

    const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }
    if (row.buyerId !== buyerId) {
      return res.status(403).json({ success: false, message: 'Đơn không thuộc tài khoản của bạn' });
    }
    if (row.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Giao dịch chưa hoàn tất thanh toán.' });
    }
    if (row.deliveryStatus !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Seller phải đánh dấu delivered trước khi bạn xác nhận nhận hàng.',
      });
    }
    if (row.receiptConfirmedAt) {
      const [again] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
      return res.status(200).json({
        success: true,
        data: withShippingAddressAlias(again!),
        message: 'Đơn đã được xác nhận nhận hàng trước đó.',
      });
    }

    const n = await confirmReceiptForSaleGroup(row.bikeId, row.buyerId, row.sellerId);
    if (n === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xác nhận — kiểm tra lại trạng thái giao hàng.',
      });
    }

    const [updated] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    return res.status(200).json({
      success: true,
      data: withShippingAddressAlias(updated!),
      message: 'Đã xác nhận nhận hàng.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xác nhận nhận hàng',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/fulfillment/v1/transactions/:id
 * Buyer hoặc seller của đơn — xem snapshot giao hàng + thanh toán.
 */
export const getFulfillmentDetail = async (req: Request, res: Response) => {
  try {
    const role = req.user!.role;
    if (role !== 'buyer' && role !== 'seller') {
      return res.status(403).json({ success: false, message: 'Chỉ buyer hoặc seller.' });
    }
    const uid = req.user!.userId;
    const id = req.params.id as string;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ' });
    }

    const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }
    if (role === 'buyer' && row.buyerId !== uid) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (role === 'seller' && row.sellerId !== uid) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.status(200).json({
      success: true,
      data: withShippingAddressAlias(row),
      message: 'Chi tiết đơn / giao hàng',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
