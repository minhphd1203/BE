const express = require('express');
const router = express.Router();
const bikeController = require('../controllers/bikeController');
const { authenticate, authorize, optional } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes (cho phép guest xem)
router.get('/search', optional, bikeController.searchBikes);
router.get('/:id', optional, bikeController.getBikeById);

// Seller routes
router.post('/', authenticate, authorize('seller', 'admin'), bikeController.createBike);
router.get('/my/listings', authenticate, authorize('seller', 'admin'), bikeController.getMyBikes);
router.put('/:id', authenticate, authorize('seller', 'admin'), bikeController.updateBike);
router.delete('/:id', authenticate, authorize('seller', 'admin'), bikeController.deleteBike);

// Upload images
router.post('/:bikeId/images', 
  authenticate, 
  authorize('seller', 'admin'),
  upload.array('images', 10),
  bikeController.uploadImages
);

router.delete('/images/:imageId', authenticate, authorize('seller', 'admin'), bikeController.deleteImage);

module.exports = router;
