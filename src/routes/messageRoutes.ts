import express from 'express';
import {
  getAllConversations,
  getConversationDetails,
  sendMessage,
  closeConversation,
} from '../controllers/messageController';
import { isAuthenticated } from '../middleware/authMiddleware';
import { messageUpload, attachFileUrl } from '../middleware/messageUploadMiddleware';

const router = express.Router();

/**
 * @swagger
 * /api/messages/conversations:
 *   get:
 *     summary: Get all conversation threads with unread count
 *     description: |
 *       Retrieve all active conversations for the authenticated user.
 *       Returns list of threads with:
 *       - Thread metadata (status, participants)
 *       - Last message in each thread
 *       - Unread message count per thread
 *       - Partner information (name, role, avatar)
 *       - Associated bike context (if any)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversation threads with unread counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       threadId:
 *                         type: string
 *                         format: uuid
 *                       status:
 *                         type: string
 *                         enum: [open, closed]
 *                       partner:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           role:
 *                             type: string
 *                           avatar:
 *                             type: string
 *                       lastMessage:
 *                         type: object
 *                       unreadCount:
 *                         type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/conversations', isAuthenticated, getAllConversations);

/**
 * @swagger
 * /api/messages/{partnerId}/{bikeId}:
 *   get:
 *     summary: Get conversation thread for specific participants and bike
 *     description: |
 *       Fetch message thread history with specific partner for specific bike context.
 *       All parameters (senderID, receiverID/partnerId, bikeID) are required.
 *       Returns error if any required parameter is missing or if thread doesn't exist.
 *       Automatically marks received messages as read.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the conversation partner (receiverID)
 *       - in: path
 *         name: bikeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the bike for this conversation context
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
 *         description: Message thread history for the specified participants and bike
 *       400:
 *         description: Required fields missing or invalid format - partnerId and bikeId are mandatory
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation thread not found for the specified participants and bike
 */
router.get('/:partnerId/:bikeId', isAuthenticated, getConversationDetails);

/**
 * @swagger
 * /api/messages/{partnerId}:
 *   post:
 *     summary: Send a message to a partner
 *     description: |
 *       Send a message to another user with optional file attachment.
 *       
 *       Role-based constraints:
 *       - **Buyer/Seller** → Admin/Inspector: Can only reply if thread exists (cannot initiate)
 *       - **Buyer/Seller** → Buyer/Seller: Can freely message (bidirectional)
 *       - **Admin/Inspector** → Anyone: Can freely message and auto-reopen closed threads
 *       
 *       **File uploads:**
 *       - Max size: 10MB
 *       - Supported: images (jpeg, png, webp, gif) and documents (pdf, doc, docx, txt)
 *       - Optional - omit for text-only messages
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [content, bikeId]
 *             properties:
 *               content:
 *                 type: string
 *                 example: Bạn còn xe không?
 *               bikeId:
 *                 type: string
 *                 format: uuid
 *                 description: Required - bike context for this message (mandatory to form conversation thread)
 *               attachment:
 *                 type: string
 *                 format: binary
 *                 description: Optional file attachment (max 10MB)
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid input (empty message, invalid IDs, etc.)
 *       403:
 *         description: |
 *           Cannot send message:
 *           - Cannot initiate to admin/inspector
 *           - Conversation is closed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Partner or bike not found
 */
router.post('/:partnerId', isAuthenticated, messageUpload, attachFileUrl, sendMessage);

/**
 * @swagger
 * /api/messages/{partnerId}/close:
 *   delete:
 *     summary: Close a conversation thread (Admin/Inspector only)
 *     description: |
 *       Close a conversation thread, blocking further messages from buyer/seller until admin/inspector sends again.
 *       
 *       **Permission:** Admin and Inspector roles only (403 for other roles)
 *       
 *       **Effects:**
 *       - Sets thread status to 'closed'
 *       - Buyer/seller cannot send messages to this thread
 *       - Admin/inspector can reopen by sending a message
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: bikeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Required - close thread for specific bike context (mandatory to identify which conversation thread to close)
 *     responses:
 *       200:
 *         description: Conversation closed successfully
 *       400:
 *         description: Invalid partner or bike ID format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only admin/inspector can close conversations
 *       404:
 *         description: Conversation not found
 */
router.delete('/:partnerId/close', isAuthenticated, closeConversation);

export default router;
