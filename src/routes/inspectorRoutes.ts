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

// Tất cả routes đều yêu cầu role Inspector
// 📊 Dashboard
router.get('/v1/dashboard', isInspector, getDashboard);

// 🔍 Danh sách xe chờ kiểm định
router.get('/v1/bikes/pending', isInspector, getPendingBikes);

// 📄 Chi tiết một xe
router.get('/v1/bikes/:bikeId', isInspector, getBikeDetail);

// 🚀 Bắt đầu kiểm định (Cập nhật status sang "in_progress")
router.post('/v1/bikes/:bikeId/start', isInspector, startInspection);

// ✅ Submit form kiểm định (Hoàn tất)
router.post('/v1/bikes/:bikeId/inspect', isInspector, submitInspection);

// 📋 Lấy lịch sử kiểm định của mình
router.get('/v1/inspections', isInspector, getMyInspections);

// 📊 Chi tiết một báo cáo kiểm định
router.get('/v1/inspections/:inspectionId', isInspector, getInspectionDetail);

// 🔄 Cập nhật báo cáo kiểm định (nếu cần sửa)
router.put('/v1/inspections/:inspectionId', isInspector, updateInspection);

export default router;
