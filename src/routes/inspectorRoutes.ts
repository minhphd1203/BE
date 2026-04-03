import express from 'express';
import { 
  getDashboard,
  getPendingBikes, 
  getBikeDetail, 
  startInspection,
  submitInspection,
  getMyInspections,
  getInspectionDetail,
  updateInspection,
  sendMessageToUser,
  closeConversation,
  getConversations,
  getMessageHistory
} from '../controllers/inspectorController';
import { isInspector } from '../middleware/authMiddleware';
import {
  parseInspectionSubmitMultipart,
  parseInspectionUpdateMultipart,
} from '../middleware/inspectionUploadMiddleware';
import { messageUpload, attachFileUrl } from '../middleware/messageUploadMiddleware';

const router = express.Router();

/**
 * @swagger
 * /api/inspector/v1/dashboard:
 *   get:
 *     summary: Get inspector dashboard statistics
 *     tags: [Inspector]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data with pending, completed, passed, and failed bike counts
 *       401:
 *         description: Unauthorized - Inspector role required
 */
router.get('/v1/dashboard', isInspector, getDashboard);

/**
 * @swagger
 * /api/inspector/v1/bikes/pending:
 *   get:
 *     summary: Get list of bikes waiting for inspection
 *     tags: [Inspector]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending bikes for inspection
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/bikes/pending', isInspector, getPendingBikes);

/**
 * @swagger
 * /api/inspector/v1/bikes/{bikeId}:
 *   get:
 *     summary: Get bike details for inspection
 *     tags: [Inspector]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bikeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bike UUID
 *     responses:
 *       200:
 *         description: Bike detail with seller and inspection history
 *       404:
 *         description: Bike not found
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/bikes/:bikeId', isInspector, getBikeDetail);

/**
 * @swagger
 * /api/inspector/v1/bikes/{bikeId}/start:
 *   post:
 *     summary: Start inspection (set status to in_progress)
 *     tags: [Inspector]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bikeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Inspection started successfully
 *       404:
 *         description: Bike not found
 *       400:
 *         description: Bike already inspected
 */
router.post('/v1/bikes/:bikeId/start', isInspector, startInspection);

/**
 * @swagger
 * /api/inspector/v1/bikes/{bikeId}/inspect:
 *   post:
 *     summary: Submit inspection form (complete inspection)
 *     tags: [Inspector]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bikeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       description: |
 *         JSON hoặc multipart/form-data. Ảnh minh chứng kiểm định upload field **inspectionImages** (nhiều file);
 *         có thể thêm URL trong body field inspectionImages (JSON string hoặc mảng).
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [status, overallCondition]
 *             properties:
 *               status: { type: string, enum: [passed, failed] }
 *               overallCondition: { type: string, enum: [excellent, good, fair, poor] }
 *               frameCondition: { type: string }
 *               brakeCondition: { type: string }
 *               drivetrainCondition: { type: string }
 *               wheelCondition: { type: string }
 *               inspectionNote: { type: string }
 *               recommendation: { type: string }
 *               reportFile: { type: string }
 *               reason:
 *                 type: string
 *                 nullable: true
 *                 description: "Khi inspection failed — lý do từ chối (optional, tối đa 10000 ký tự). Với passed bị bỏ qua."
 *               inspectionImages:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh minh chứng (jpeg/png/webp/gif), field name inspectionImages
 *           encoding:
 *             inspectionImages:
 *               contentType: image/png, image/jpeg, image/webp, image/gif
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [passed, failed]
 *               overallCondition:
 *                 type: string
 *                 enum: [excellent, good, fair, poor]
 *               frameCondition:
 *                 type: string
 *               brakeCondition:
 *                 type: string
 *               drivetrainCondition:
 *                 type: string
 *               wheelCondition:
 *                 type: string
 *               inspectionNote:
 *                 type: string
 *               recommendation:
 *                 type: string
 *               reason:
 *                 type: string
 *                 nullable: true
 *                 description: "Lý do khi failed (optional)"
 *               inspectionImages:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Inspection submitted successfully
 *       404:
 *         description: Bike not found
 */
router.post('/v1/bikes/:bikeId/inspect', isInspector, parseInspectionSubmitMultipart, submitInspection);

/**
 * @swagger
 * /api/inspector/v1/inspections:
 *   get:
 *     summary: Get my inspection history
 *     tags: [Inspector]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by bike title or brand
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [passed, failed]
 *     responses:
 *       200:
 *         description: List of inspections by current inspector
 */
router.get('/v1/inspections', isInspector, getMyInspections);

/**
 * @swagger
 * /api/inspector/v1/inspections/{inspectionId}:
 *   get:
 *     summary: Get inspection report details
 *     tags: [Inspector]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inspectionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Inspection report details
 *       404:
 *         description: Inspection not found
 */
router.get('/v1/inspections/:inspectionId', isInspector, getInspectionDetail);

/**
 * @swagger
 * /api/inspector/v1/inspections/{inspectionId}:
 *   put:
 *     summary: Update inspection report
 *     tags: [Inspector]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inspectionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       description: JSON hoặc multipart — thêm ảnh minh chứng qua field file inspectionImages.
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [passed, failed] }
 *               overallCondition: { type: string, enum: [excellent, good, fair, poor] }
 *               frameCondition: { type: string }
 *               brakeCondition: { type: string }
 *               drivetrainCondition: { type: string }
 *               wheelCondition: { type: string }
 *               inspectionNote: { type: string }
 *               recommendation: { type: string }
 *               reportFile: { type: string }
 *               reason:
 *                 type: string
 *                 nullable: true
 *                 description: "Lý do từ chối khi failed; gửi null/empty để xóa. Khi chuyển passed → tự xóa."
 *               inspectionImages:
 *                 type: string
 *                 format: binary
 *           encoding:
 *             inspectionImages:
 *               contentType: image/png, image/jpeg, image/webp, image/gif
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [passed, failed]
 *               overallCondition:
 *                 type: string
 *               frameCondition:
 *                 type: string
 *               inspectionNote:
 *                 type: string
 *               recommendation:
 *                 type: string
 *               reason:
 *                 type: string
 *                 nullable: true
 *               inspectionImages:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Inspection updated successfully
 *       404:
 *         description: Inspection not found
 */
router.put('/v1/inspections/:inspectionId', isInspector, parseInspectionUpdateMultipart, updateInspection);

// ================== MESSAGING ==================

/**
 * @swagger
 * /api/inspector/v1/messages/{userId}:
 *   post:
 *     summary: Inspector sends message to user
 *     description: |
 *       Inspector can freely send messages to any user (buyer/seller/admin).
 *       No restrictions on who inspector can message (same as admin).
 *       
 *       **Supports file/image attachments:**
 *       - Upload single file via `attachment` form field (multipart/form-data)
 *       - Allowed formats: images (jpeg, png, webp, gif) and documents (pdf, doc, docx, txt)
 *       - Max file size: 10MB
 *       - Optional: leave empty to send text-only message
 *       
 *       **Conversation lifecycle:**
 *       - New message: conversationStatus set to 'active'
 *       - User can reply if conversation is 'active'
 *       - User cannot reply if conversation is 'closed'
 *     tags: [Inspector - Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Target user ID (buyer, seller, or other admin/inspector)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Message content (required, non-empty)
 *               bikeId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional bike ID reference
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: Optional file attachment (image or document, max 10MB)
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     senderId:
 *                       type: string
 *                       format: uuid
 *                     receiverId:
 *                       type: string
 *                       format: uuid
 *                     content:
 *                       type: string
 *                     bikeId:
 *                       type: string
 *                       format: uuid
 *                       nullable: true
 *                     fileUrl:
 *                       type: string
 *                       nullable: true
 *                       description: URL to attached file if uploaded
 *                     isRead:
 *                       type: boolean
 *                     conversationStatus:
 *                       type: string
 *                       example: "active"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     receiver:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         role:
 *                           type: string
 *       400:
 *         description: Invalid input (empty content, invalid IDs, unsupported file type)
 *       404:
 *         description: User or bike not found
 *       401:
 *         description: Unauthorized - Inspector role required
 */
router.post('/v1/messages/:userId', isInspector, messageUpload, attachFileUrl, sendMessageToUser);

/**
 * @swagger
 * /api/inspector/v1/conversations/{userId}/close:
 *   put:
 *     summary: Close a conversation with user (buyer/seller/admin)
 *     tags: [Inspector - Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of user to close conversation with
 *     responses:
 *       200:
 *         description: Conversation closed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       format: uuid
 *                     conversationStatus:
 *                       type: string
 *                       enum: [closed]
 *                     totalMessagesInConversation:
 *                       type: integer
 *                     closedAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       404:
 *         description: Conversation not found
 *       401:
 *         description: Unauthorized - Inspector role required
 */
router.put('/v1/conversations/:userId/close', isInspector, closeConversation);

/**
 * @swagger
 * /api/inspector/v1/conversations:
 *   get:
 *     summary: Get all conversations for inspector
 *     description: Inspector retrieves all active conversations (received and sent messages)
 *     tags: [Inspector - Conversations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
 *       401:
 *         description: Unauthorized - Inspector role required
 */
router.get('/v1/conversations', isInspector, getConversations);

/**
 * @swagger
 * /api/inspector/v1/conversations/{userId}:
 *   get:
 *     summary: Get message history with a specific user
 *     description: Inspector retrieves conversation history with one user (paginated)
 *     tags: [Inspector - Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: bikeId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by bike (optional)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Message history
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/conversations/:userId', isInspector, getMessageHistory);

export default router;
