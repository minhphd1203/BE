import express from 'express';
import { 
  getDashboard,
  getPendingBikes, 
  getBikeDetail, 
  startInspection,
  submitInspection,
  getMyInspections,
  getInspectionDetail,
  updateInspection
} from '../controllers/inspectorController';
import { isInspector } from '../middleware/authMiddleware';

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
 *       content:
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
router.post('/v1/bikes/:bikeId/inspect', isInspector, submitInspection);

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
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               overallCondition:
 *                 type: string
 *               inspectionNote:
 *                 type: string
 *               recommendation:
 *                 type: string
 *     responses:
 *       200:
 *         description: Inspection updated successfully
 *       404:
 *         description: Inspection not found
 */
router.put('/v1/inspections/:inspectionId', isInspector, updateInspection);

export default router;
