const express = require('express');
const router = express.Router();
const inspectionController = require('../controllers/inspectionController');
const { authenticate, authorize } = require('../middleware/auth');

// Seller request inspection
router.post('/request', authenticate, authorize('seller', 'admin'), inspectionController.requestInspection);

// Inspector routes
router.get('/inspector/my-inspections', authenticate, authorize('inspector', 'admin'), inspectionController.getInspectorInspections);
router.get('/pending', authenticate, authorize('inspector', 'admin'), inspectionController.getPendingInspections);
router.put('/:id', authenticate, authorize('inspector', 'admin'), inspectionController.updateInspection);

// Public route
router.get('/bike/:bikeId', inspectionController.getBikeInspections);

module.exports = router;
