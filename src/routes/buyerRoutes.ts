import express from 'express';
import {
  searchBikes,
  getBikeDetail,
  getRecommendedBikes,
} from '../controllers/buyerController';
import { isAuthenticated } from '../middleware/authMiddleware';

const router = express.Router();

// ⭐ STATIC ROUTES MUST COME FIRST (before :bikeId)

//  Get recommended bikes on homepage (latest verified)
router.get('/v1/bikes/recommended', isAuthenticated, getRecommendedBikes);

//  Search bikes with filters
// Query parameters: brand, model, minPrice, maxPrice, condition, color, sortBy, sortOrder, page, limit
router.get('/v1/bikes/search', isAuthenticated, searchBikes);

//  Get bike detail by ID (MUST BE LAST - dynamic route)
router.get('/v1/bikes/:bikeId', isAuthenticated, getBikeDetail);

export default router;
