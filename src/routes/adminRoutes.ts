import express from 'express';
import { 
  getAllBikes, 
  approveBike,
  rejectBike,
  getPendingApprovalBikes,
  getAllUser, 
  updateUser, 
  deleteUser,
  getAllTransaction,
  updateTransaction,
  getAllReports,
  resolveReport,
  getAllCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllReportReasons,
  createReportReason,
  updateReportReason,
  deleteReportReason,
  deleteBike,
  closeConversation,
  sendMessageToUser,
  getConversations,
  getMessageHistory
} from '../controllers/adminController';
import { isAdmin } from '../middleware/authMiddleware';
import { messageUpload, attachFileUrl } from '../middleware/messageUploadMiddleware';

const router = express.Router();

// ================== BIKE MANAGEMENT ==================

/**
 * @swagger
 * /api/admin/v1/bike:
 *   get:
 *     summary: Get all bikes with filter options
 *     tags: [Admin - Bikes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by bike title or brand
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest]
 *     responses:
 *       200:
 *         description: List of all bikes
 *       401:
 *         description: Unauthorized - Admin role required
 */
router.get('/v1/bike', isAdmin, getAllBikes);

/**
 * @swagger
 * /api/admin/v1/bike/{bikeId}/approve:
 *   put:
 *     summary: Approve a bike for listing
 *     description: |
 *       Admin approves bike (must have inspector verification first)
 *       Bike must have isVerified: verified and status: pending
 *       Changes status from pending → approved (goes public)
 *     tags: [Admin - Bikes]
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
 *         description: Bike approved successfully
 *       404:
 *         description: Bike not found
 *       400:
 *         description: Bike not verified by inspector or not pending
 */
router.put('/v1/bike/:id/approve', isAdmin, approveBike);

/**
 * @swagger
 * /api/admin/v1/bike/{bikeId}/reject:
 *   put:
 *     summary: Reject a bike listing
 *     description: |
 *       Admin rejects bike for business reasons (must have inspector verification first)
 *       Bike must have isVerified: verified and status: pending
 *       Changes status from pending → rejected
 *       Seller must fix issues and resubmit
 *     tags: [Admin - Bikes]
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *     responses:
 *       200:
 *         description: Bike rejected successfully
 *       404:
 *         description: Bike not found
 *       400:
 *         description: Bike not verified by inspector or not pending
 */
router.put('/v1/bike/:id/reject', isAdmin, rejectBike);

/**
 * @swagger
 * /api/admin/v1/bikes/pending-approval:
 *   get:
 *     summary: Get all bikes pending admin approval
 *     description: |
 *       Retrieves bikes that have passed inspector verification and are waiting for admin approval/rejection
 *       Filters for: isVerified=verified AND status=pending AND inspectionStatus=completed
 *       Includes seller details and full inspection report for admin review
 *     tags: [Admin - Bikes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by bike title or brand
 *     responses:
 *       200:
 *         description: List of bikes pending approval with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bikes:
 *                   type: array
 *                 totalCount:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *       401:
 *         description: Unauthorized - Admin role required
 */
router.get('/v1/bikes/pending-approval', isAdmin, getPendingApprovalBikes);

// ================== USER MANAGEMENT ==================

/**
 * @swagger
 * /api/admin/v1/user:
 *   get:
 *     summary: Get all users with filtering options
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email or name
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [buyer, inspector, admin]
 *     responses:
 *       200:
 *         description: List of all users
 */
router.get('/v1/user', isAdmin, getAllUser);

/**
 * @swagger
 * /api/admin/v1/user/{userId}:
 *   put:
 *     summary: Update user information
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *             properties:
 *               email:
 *                 type: string
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put('/v1/user/:id', isAdmin, updateUser);

/**
 * @swagger
 * /api/admin/v1/user/{userId}:
 *   delete:
 *     summary: Delete a user account
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete('/v1/user/:id', isAdmin, deleteUser);

// ================== TRANSACTION MANAGEMENT ==================

/**
 * @swagger
 * /api/admin/v1/transaction:
 *   get:
 *     summary: Get all transactions
 *     tags: [Admin - Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest]
 *     responses:
 *       200:
 *         description: List of all transactions
 */
router.get('/v1/transaction', isAdmin, getAllTransaction);

/**
 * @swagger
 * /api/admin/v1/transaction/{transactionId}:
 *   put:
 *     summary: Update transaction status
 *     tags: [Admin - Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
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
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, completed, cancelled]
 *     responses:
 *       200:
 *         description: Transaction updated successfully
 *       404:
 *         description: Transaction not found
 */
router.put('/v1/transaction/:id', isAdmin, updateTransaction);

// ================== REPORT MANAGEMENT ==================

/**
 * @swagger
 * /api/admin/v1/report:
 *   get:
 *     summary: Get all buyer complaints/reports
 *     tags: [Admin - Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, resolved, closed]
 *     responses:
 *       200:
 *         description: List of all reports
 */
router.get('/v1/report', isAdmin, getAllReports);

/**
 * @swagger
 * /api/admin/v1/report/{reportId}/resolve:
 *   post:
 *     summary: Mark a report as resolved
 *     tags: [Admin - Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
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
 *             properties:
 *               resolution:
 *                 type: string
 *                 description: Resolution description
 *               status:
 *                 type: string
 *                 enum: [resolved, rejected]
 *                 description: Status of the report
 *     responses:
 *       200:
 *         description: Report resolved successfully
 *       404:
 *         description: Report not found
 */
router.post('/v1/report/:id/resolve', isAdmin, resolveReport);

// ================== CATEGORY MANAGEMENT ==================

/**
 * @swagger
 * /api/admin/v1/category:
 *   get:
 *     summary: Get all bike categories
 *     tags: [Admin - Categories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all categories
 */
router.get('/v1/category', isAdmin, getAllCategory);

/**
 * @swagger
 * /api/admin/v1/category:
 *   post:
 *     summary: Create a new bike category
 *     tags: [Admin - Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Invalid input or category already exists
 */
router.post('/v1/category', isAdmin, createCategory);

/**
 * @swagger
 * /api/admin/v1/category/{categoryId}:
 *   put:
 *     summary: Update a bike category
 *     tags: [Admin - Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 */
router.put('/v1/category/:id', isAdmin, updateCategory);

/**
 * @swagger
 * /api/admin/v1/category/{categoryId}:
 *   delete:
 *     summary: Delete a bike category
 *     tags: [Admin - Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       404:
 *         description: Category not found or in use
 */
router.delete('/v1/category/:id', isAdmin, deleteCategory);

// ================== REPORT REASONS MANAGEMENT ==================

/**
 * @swagger
 * /api/admin/v1/report-reasons:
 *   get:
 *     summary: Get all violation/reason types for reports
 *     tags: [Admin - Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all report violation types
 */
router.get('/v1/report-reasons', isAdmin, getAllReportReasons);

/**
 * @swagger
 * /api/admin/v1/report-reasons:
 *   post:
 *     summary: Create a new violation type for reports
 *     tags: [Admin - Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Bike Condition/Quality Issue"
 *               description:
 *                 type: string
 *                 example: "Bike received is different from seller description"
 *               isSystemAutoResolvable:
 *                 type: boolean
 *                 example: true
 *               autoResolveAction:
 *                 type: string
 *                 example: "delete_bike"
 *     responses:
 *       201:
 *         description: Violation type created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/v1/report-reasons', isAdmin, createReportReason);

/**
 * @swagger
 * /api/admin/v1/report-reasons/{reasonId}:
 *   put:
 *     summary: Update a violation type
 *     tags: [Admin - Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reasonId
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isSystemAutoResolvable:
 *                 type: boolean
 *               autoResolveAction:
 *                 type: string
 *     responses:
 *       200:
 *         description: Violation type updated successfully
 *       404:
 *         description: Violation type not found
 */
router.put('/v1/report-reasons/:id', isAdmin, updateReportReason);

/**
 * @swagger
 * /api/admin/v1/report-reasons/{reasonId}:
 *   delete:
 *     summary: Delete a violation type
 *     tags: [Admin - Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reasonId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Violation type deleted successfully
 *       400:
 *         description: Cannot delete system auto-resolvable types
 *       404:
 *         description: Violation type not found
 */
router.delete('/v1/report-reasons/:id', isAdmin, deleteReportReason);

// ================== BIKE DELETION ==================

/**
 * @swagger
 * /api/admin/v1/bikes/{bikeId}:
 *   delete:
 *     summary: Delete a bike (only if status is approved, reserved, or sold)
 *     tags: [Admin - Bikes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bikeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bike ID to delete
 *     responses:
 *       200:
 *         description: Bike deleted successfully (removed from listing)
 *       400:
 *         description: Can only delete bikes with specific statuses
 *       404:
 *         description: Bike not found
 */
router.delete('/v1/bikes/:bikeId', isAdmin, deleteBike);

// ================== CONVERSATION MANAGEMENT ==================

/**
 * @swagger
 * /api/admin/v1/conversations/{userId}/close:
 *   post:
 *     summary: Close a conversation with buyer/seller (admin can contact them anytime)
 *     description: |
 *       Admin/Inspector can close active conversations with users.
 *       
 *       **When closed:**
 *       - User cannot send messages to this admin/inspector
 *       - User sees error: "This conversation has been closed"
 *       - Admin can start a new conversation anytime by messaging the user
 *       
 *       **Use case:** After resolving an issue, admin closes to prevent spam/unnecessary contact.
 *     tags: [Admin - Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID (buyer or seller) to close conversation with
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
 *                       example: "closed"
 *                     totalMessagesInConversation:
 *                       type: integer
 *                     closedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: No conversation found with this user
 *       401:
 *         description: Unauthorized
 */
router.post('/v1/conversations/:userId/close', isAdmin, closeConversation);

// ================== MESSAGING ==================

/**
 * @swagger
 * /api/admin/v1/messages/{userId}:
 *   post:
 *     summary: Admin sends message to user
 *     description: |
 *       Admin can freely send messages to any user (buyer/seller/inspector).
 *       No restrictions on who admin can message.
 *       
 *       **Supports file/image attachments:**
 *       - Upload single file via `attachment` form field (multipart/form-data)
 *       - Allowed formats: images (jpeg, png, webp, gif) and documents (pdf, doc, docx, txt)
 *       - Max file size: 10MB
 *       - Optional: leave empty to send text-only message
 *       
 *       **Key differences from buyer/seller messaging:**
 *       - Admin CAN initiate conversations with anyone
 *       - Admin CAN send to admin/inspector accounts
 *       - No restrictions on closed conversations for admin (can reopen by sending new message)
 *       
 *       **Conversation lifecycle:**
 *       - New message: conversationStatus set to 'active'
 *       - User can reply if conversation is 'active'
 *       - User cannot reply if conversation is 'closed'
 *       - Admin can send new message to reopen closed conversation
 *     tags: [Admin - Conversations]
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
 *                 description: Optional bike ID reference (for bike-related conversations)
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
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input (empty content, invalid IDs, unsupported file type)
 *       404:
 *         description: User or bike not found
 *       401:
 *         description: Unauthorized - Admin role required
 */
router.post('/v1/messages/:userId', isAdmin, messageUpload, attachFileUrl, sendMessageToUser);

/**
 * @swagger
 * /api/admin/v1/conversations:
 *   get:
 *     summary: Get all conversations for admin
 *     description: Admin retrieves all active conversations (received and sent messages)
 *     tags: [Admin - Conversations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
 *       401:
 *         description: Unauthorized - Admin role required
 */
router.get('/v1/conversations', isAdmin, getConversations);

/**
 * @swagger
 * /api/admin/v1/conversations/{userId}:
 *   get:
 *     summary: Get message history with a specific user
 *     description: Admin retrieves conversation history with one user (paginated)
 *     tags: [Admin - Conversations]
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
router.get('/v1/conversations/:userId', isAdmin, getMessageHistory);

export default router;