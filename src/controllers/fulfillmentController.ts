import { Request, Response } from 'express';
import { db } from '../db';
import { bikes, transactions, deliveries } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { updateDeliveryStatusSchema } from '../validators/transactionValidator';
import type { DeliveryStatus } from '../constants/fulfillment';
import { applyDeliveryPatchToSaleGroup, confirmReceiptForSaleGroup } from '../services/fulfillmentSync';
import { withShippingAddressAlias } from '../utils/transactionResponse';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper: Fetch transaction with explicit columns
function selectValidTransactionColumns() {
  return db.select().from(transactions);
}

/**
 * PATCH /api/fulfillment/v1/transactions/:id/delivery
 * Seller workflow:
 * 1. Create delivery with 'preparing' status (if none exists)
 * 2. Update delivery from 'preparing' → 'delivering'
 * 3. Buyer confirms receipt (separate endpoint)
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

    // ===== STEP 1: Fetch and validate transaction =====
    const [txn] = await selectValidTransactionColumns().where(eq(transactions.id, id)).limit(1);
    if (!txn) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }

    // Authorization: only seller of this transaction
    if (txn.sellerId !== sellerId) {
      return res.status(403).json({ success: false, message: 'Bạn không phải seller của đơn này' });
    }

    // Transaction must be completed
    if (txn.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Chỉ giao dịch đã thanh toán xong (completed) mới có giao hàng. Hiện tại: ${txn.status}`,
      });
    }

    // ===== STEP 2: Verify bike is sold =====
    const [bike] = await db.select().from(bikes).where(eq(bikes.id, txn.bikeId)).limit(1);
    if (!bike) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
    }
    if (bike.status !== 'sold') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ khi xe ở trạng thái sold (đã thanh toán đủ) mới được cập nhật giao hàng.',
      });
    }

    // ===== STEP 3: Fetch current delivery (if exists) =====
    let delivery = null;
    if (txn.deliveryId) {
      const [delRow] = await db.select().from(deliveries).where(eq(deliveries.id, txn.deliveryId)).limit(1);
      delivery = delRow;
    }

    // ===== STEP 4: Handle 'preparing' status =====
    if (nextStatus === 'preparing') {
      // Can only CREATE new delivery with 'preparing', not update existing
      if (delivery) {
        return res.status(400).json({
          success: false,
          message: `Delivery record đã tồn tại với trạng thái "${delivery.deliveryStatus}". Không thể reset lại "preparing".`,
        });
      }

      // Create new delivery record
      const inserted = await db
        .insert(deliveries)
        .values({
          deliveryStatus: 'preparing',
          deliveryNotes: deliveryNotes?.trim() || null,
        })
        .returning();

      if (!inserted || inserted.length === 0 || !inserted[0]?.id) {
        console.error('[updateDeliveryStatus] Insert failed:', inserted);
        return res.status(500).json({
          success: false,
          message: 'Lỗi khi tạo delivery record',
        });
      }

      const newDelId = inserted[0].id;

      // Link ALL transactions in this sale group to the NEW delivery
      await db
        .update(transactions)
        .set({ deliveryId: newDelId })
        .where(
          and(
            eq(transactions.bikeId, txn.bikeId),
            eq(transactions.buyerId, txn.buyerId),
            eq(transactions.sellerId, txn.sellerId),
            eq(transactions.status, 'completed')
          )
        );

      // Fetch updated transaction WITH delivery data
      const [updatedTxn] = await selectValidTransactionColumns().where(eq(transactions.id, id)).limit(1);
      const [del] = await db.select().from(deliveries).where(eq(deliveries.id, newDelId)).limit(1);

      const responseData = {
        ...withShippingAddressAlias(updatedTxn!),
        deliveryStatus: del?.deliveryStatus || null,
        deliveryNotes: del?.deliveryNotes || null,
        receiptConfirmedAt: del?.receiptConfirmedAt || null,
      };

      return res.status(200).json({
        success: true,
        data: responseData,
        message: 'Đã tạo delivery record với trạng thái "preparing".',
      });
    }

    // ===== STEP 5: Handle 'delivering' status =====
    if (nextStatus === 'delivering') {
      // Delivery must already exist
      if (!delivery) {
        return res.status(400).json({
          success: false,
          message: 'Delivery chưa được tạo. Hãy set thành "preparing" trước.',
        });
      }

      // Must be in 'preparing' state to transition to 'delivering'
      if (delivery.deliveryStatus !== 'preparing') {
        return res.status(400).json({
          success: false,
          message: `Chỉ chuyển "delivering" từ "preparing". Trạng thái hiện tại: ${delivery.deliveryStatus}`,
        });
      }

      // Cannot update if buyer already confirmed receipt
      if (delivery.receiptConfirmedAt) {
        return res.status(400).json({
          success: false,
          message: 'Người mua đã xác nhận nhận hàng — không thể đổi trạng thái.',
        });
      }

      // Update the delivery record
      await db
        .update(deliveries)
        .set({
          deliveryStatus: 'delivering',
          deliveryNotes: deliveryNotes !== undefined ? deliveryNotes : undefined,
        })
        .where(eq(deliveries.id, delivery.id));

      // Fetch updated transaction WITH updated delivery data
      const [updatedTxn] = await selectValidTransactionColumns().where(eq(transactions.id, id)).limit(1);
      const [updatedDel] = await db.select().from(deliveries).where(eq(deliveries.id, delivery.id)).limit(1);

      const responseData = {
        ...withShippingAddressAlias(updatedTxn!),
        deliveryStatus: updatedDel?.deliveryStatus || null,
        deliveryNotes: updatedDel?.deliveryNotes || null,
        receiptConfirmedAt: updatedDel?.receiptConfirmedAt || null,
      };

      return res.status(200).json({
        success: true,
        data: responseData,
        message: 'Đã cập nhật trạng thái giao hàng thành "delivering".',
      });
    }

    // ===== STEP 6: Reject 'delivered' (buyer-only) =====
    if (nextStatus === 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Seller không thể đặt "delivered". Chỉ buyer xác nhận nhận hàng. (Sử dụng endpoint confirm-receipt)',
      });
    }

    // ===== STEP 7: Unknown status =====
    return res.status(400).json({
      success: false,
      message: `Trạng thái không hợp lệ: ${nextStatus}. Cho phép: preparing, delivering`,
    });

  } catch (error) {
    console.error('[updateDeliveryStatus] Error:', error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : '');
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật giao hàng',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * POST /api/fulfillment/v1/transactions/:id/confirm-receipt
 * Buyer: xác nhận đã nhận hàng sau delivering (changes status to delivered).
 */
export const confirmReceipt = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.userId;
    const id = req.params.id as string;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, message: 'ID giao dịch không hợp lệ' });
    }

    const row = await selectValidTransactionColumns().where(eq(transactions.id, id)).limit(1);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }
    if (row[0].buyerId !== buyerId) {
      return res.status(403).json({ success: false, message: 'Đơn không thuộc tài khoản của bạn' });
    }
    if (row[0].status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Giao dịch chưa hoàn tất thanh toán.' });
    }

    // Get delivery record
    let delivery = null;
    if (row[0].deliveryId) {
      const [delRow] = await db.select().from(deliveries).where(eq(deliveries.id, row[0].deliveryId)).limit(1);
      delivery = delRow;
    }

    if (delivery?.deliveryStatus !== 'delivering') {
      return res.status(400).json({
        success: false,
        message: 'Seller phải đánh dấu "delivering" trước khi bạn xác nhận nhận hàng.',
      });
    }
    
    if (delivery?.receiptConfirmedAt) {
      const again = await selectValidTransactionColumns().where(eq(transactions.id, id)).limit(1);
      let againDel = null;
      if (row[0].deliveryId) {
        const result = await db.select().from(deliveries).where(eq(deliveries.id, row[0].deliveryId)).limit(1);
        againDel = result[0] || null;
      }
      
      const responseData = {
        ...withShippingAddressAlias(again![0]),
        deliveryStatus: againDel?.deliveryStatus || null,
        deliveryNotes: againDel?.deliveryNotes || null,
        receiptConfirmedAt: againDel?.receiptConfirmedAt || null,
      };

      return res.status(200).json({
        success: true,
        data: responseData,
        message: 'Đơn đã được xác nhận nhận hàng trước đó.',
      });
    }

    // Buyer confirms → change status to 'delivered' + set receiptConfirmedAt
    const now = new Date();
    const n = await confirmReceiptForSaleGroup(row[0].bikeId, row[0].buyerId, row[0].sellerId, now);
    if (n === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xác nhận — kiểm tra lại trạng thái giao hàng.',
      });
    }

    const updated = await selectValidTransactionColumns().where(eq(transactions.id, id)).limit(1);
    let updatedDel = null;
    if (row[0].deliveryId) {
      const result = await db.select().from(deliveries).where(eq(deliveries.id, row[0].deliveryId)).limit(1);
      updatedDel = result[0] || null;
    }
    
    const responseData = {
      ...withShippingAddressAlias(updated![0]),
      deliveryStatus: updatedDel?.deliveryStatus || null,
      deliveryNotes: updatedDel?.deliveryNotes || null,
      receiptConfirmedAt: updatedDel?.receiptConfirmedAt || null,
    };

    return res.status(200).json({
      success: true,
      data: responseData,
      message: 'Đã xác nhận nhận hàng. Trạng thái cập nhật thành "delivered".',
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

    const row = await selectValidTransactionColumns().where(eq(transactions.id, id)).limit(1);
    if (!row || row.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
    }
    if (role === 'buyer' && row[0].buyerId !== uid) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (role === 'seller' && row[0].sellerId !== uid) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Get delivery data if exists
    let deliveryStatus = null;
    let deliveryNotes = null;
    let receiptConfirmedAt = null;
    if (row[0].deliveryId) {
      const [del] = await db.select().from(deliveries).where(eq(deliveries.id, row[0].deliveryId)).limit(1);
      deliveryStatus = del?.deliveryStatus || null;
      deliveryNotes = del?.deliveryNotes || null;
      receiptConfirmedAt = del?.receiptConfirmedAt || null;
    }

    const responseData = {
      ...withShippingAddressAlias(row[0]),
      deliveryStatus,
      deliveryNotes,
      receiptConfirmedAt,
    };

    return res.status(200).json({
      success: true,
      data: responseData,
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
