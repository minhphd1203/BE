const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, wishlistController.addToWishlist);
router.delete('/:bikeId', authenticate, wishlistController.removeFromWishlist);
router.get('/', authenticate, wishlistController.getWishlist);
router.get('/check/:bikeId', authenticate, wishlistController.checkWishlist);

module.exports = router;
