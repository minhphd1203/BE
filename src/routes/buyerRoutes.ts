import express from 'express';
import {
  searchBikes,
  getBikeDetail,
  getRecommendedBikes,
} from '../controllers/buyerController';
import { isAuthenticated } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * @swagger
 * /api/buyer/v1/bikes/recommended:
 *   get:
 *     summary: Get recommended bikes (latest approved bikes for homepage)
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of bikes to return
 *     responses:
 *       200:
 *         description: Recommended bikes fetched successfully
 *       401:
 *         description: Unauthorized - No token provided
 */
router.get('/v1/bikes/recommended', isAuthenticated, getRecommendedBikes);

/**
 * @swagger
 * /api/buyer/v1/bikes/search:
 *   get:
 *     summary: Search bikes with filters
 *     tags: [Buyer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Bike brand (partial match)
 *       - in: query
 *         name: model
 *         schema:
 *           type: string
 *         description: Bike model (partial match)
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price
 *       - in: query
 *         name: condition
 *         schema:
 *           type: string
 *           enum: [excellent, good, fair, poor]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price, year, mileage, createdAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Bikes searched successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/bikes/search', isAuthenticated, searchBikes);

/**
 * @swagger
 * /api/buyer/v1/bikes/{bikeId}:
 *   get:
 *     summary: Get bike details by ID
 *     tags: [Buyer]
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
 *         description: Bike detail with full info and inspection report
 *       400:
 *         description: Invalid bike ID format
 *       404:
 *         description: Bike not found
 *       401:
 *         description: Unauthorized
 */
router.get('/v1/bikes/:bikeId', isAuthenticated, getBikeDetail);

export default router;
