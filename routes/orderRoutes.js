const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

// Buyer routes
router.post('/', authenticate, authorize('buyer', 'seller'), orderController.createOrder);
router.get('/my-orders', authenticate, orderController.getMyOrders);

// Seller routes
router.get('/seller-orders', authenticate, authorize('seller', 'admin'), orderController.getSellerOrders);

// Shared routes
router.get('/:id', authenticate, orderController.getOrderById);
router.put('/:id/status', authenticate, orderController.updateOrderStatus);

module.exports = router;
