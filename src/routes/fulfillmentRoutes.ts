import express from 'express';
import { isAuthenticated, requireRole } from '../middleware/authMiddleware';
import {
  confirmReceipt,
  getFulfillmentDetail,
  updateDeliveryStatus,
} from '../controllers/fulfillmentController';

const router = express.Router();

/**
 * @swagger
 * /api/fulfillment/v1/transactions/{id}:
 *   get:
 *     summary: Chi tiết đơn kèm trạng thái giao hàng
 *     tags: [Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: OK
 *       403:
 *         description: Không phải buyer/seller của đơn
 */
router.get(
  '/v1/transactions/:id',
  isAuthenticated,
  requireRole('buyer', 'seller'),
  getFulfillmentDetail
);

/**
 * @swagger
 * /api/fulfillment/v1/transactions/{id}/delivery:
 *   patch:
 *     summary: Seller cập nhật trạng thái giao hàng (preparing → delivering → delivered)
 *     tags: [Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [preparing, delivering, delivered]
 *               deliveryNotes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Đã cập nhật (đồng bộ mọi giao dịch cùng đơn)
 */
router.patch(
  '/v1/transactions/:id/delivery',
  isAuthenticated,
  requireRole('seller'),
  updateDeliveryStatus
);

/**
 * @swagger
 * /api/fulfillment/v1/transactions/{id}/confirm-receipt:
 *   post:
 *     summary: Buyer xác nhận đã nhận hàng (sau delivered)
 *     tags: [Fulfillment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: OK
 */
router.post(
  '/v1/transactions/:id/confirm-receipt',
  isAuthenticated,
  requireRole('buyer'),
  confirmReceipt
);

export default router;
