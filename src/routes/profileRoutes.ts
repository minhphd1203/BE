import express from 'express';
import { upgradeToSeller, downgradeFromSeller, getProfile, getOtherProfile } from '../controllers/profileController';
import { isAuthenticated } from '../middleware/authMiddleware';

const router = express.Router();

// All profile routes require authentication
router.use(isAuthenticated);

/**
 * @swagger
 * /api/profile/v1/info:
 *   get:
 *     summary: Get current user profile information
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [buyer, seller, inspector, admin]
 *                     avatar:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - No token provided
 *       404:
 *         description: User not found
 */
router.get('/v1/info', getProfile);

/**
 * @swagger
 * /api/profile/v1/upgrade-seller:
 *   post:
 *     summary: Upgrade buyer account to seller
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     description: "Only buyers can upgrade to seller. After upgrade, you can access seller endpoints and start listing bikes for sale."
 *     responses:
 *       200:
 *         description: Successfully upgraded to seller
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *                       example: seller
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: "Successfully upgraded to seller! You can now start selling bikes."
 *       400:
 *         description: Cannot upgrade (not a buyer, or already a seller/admin/inspector)
 *       401:
 *         description: Unauthorized - No token provided
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/v1/upgrade-seller', upgradeToSeller);

/**
 * @swagger
 * /api/profile/v1/downgrade-seller:
 *   post:
 *     summary: Downgrade seller account back to buyer
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     description: "Only sellers can downgrade to buyer. All active bike listings will be hidden (not deleted). Cannot downgrade if you have pending transactions."
 *     responses:
 *       200:
 *         description: Successfully downgraded to buyer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *                       example: buyer
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *                   example: "Successfully downgraded to buyer. Your listings have been hidden but can be reactivated if you become a seller again."
 *       400:
 *         description: Cannot downgrade (not a seller, or have pending transactions)
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             message:
 *               type: string
 *             pendingTransactionId:
 *               type: string
 *               description: "ID of pending transaction blocking the downgrade"
 *       401:
 *         description: Unauthorized - No token provided
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.post('/v1/downgrade-seller', downgradeFromSeller);

/**
 * @swagger
 * /api/profile/v1/{userId}:
 *   get:
 *     summary: View another user's profile (buyer/seller only)
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: ID of the user profile to view
 *         schema:
 *           type: string
 *           format: uuid
 *     description: "View public profile of another buyer or seller. Returns limited info (excludes email, phone for privacy). Cannot view inspector or admin profiles."
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [buyer, seller]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - No token provided
 *       403:
 *         description: Access denied - Cannot view inspector or admin profiles
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/v1/:userId', getOtherProfile);

export default router;
