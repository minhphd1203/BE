const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('buyer', 'seller'), reviewController.createReview);
router.get('/seller/:sellerId', reviewController.getSellerReviews);

module.exports = router;
