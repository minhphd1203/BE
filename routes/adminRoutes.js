const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

// Tất cả routes đều yêu cầu admin role
router.use(authenticate, authorize('admin'));

// User management
router.get('/users', adminController.getAllUsers);
router.put('/users/:userId/status', adminController.toggleUserStatus);

// Bike management
router.get('/bikes/pending', adminController.getPendingBikes);
router.put('/bikes/:bikeId/approve', adminController.approveBike);

// Statistics
router.get('/statistics', adminController.getStatistics);

// Categories & Brands
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.get('/brands', adminController.getBrands);
router.post('/brands', adminController.createBrand);

module.exports = router;
