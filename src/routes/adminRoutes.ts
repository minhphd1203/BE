import express from 'express';
import { 
  getAllBikes, 
  approveBike, 
  rejectBike, 
  deleteBike,
  getAllUser, 
  updateUser, 
  deleteUser,
  getAllTransaction,
  updateTransaction,
  getAllReports,
  resolveReport,
  getAllCategory,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/adminController';
import { isAdmin } from '../middleware/authMiddleware'; // Import middleware kiểm tra quyền admin

const router = express.Router();

// Quản lý xe đạp
router.get('/v1/bike', isAdmin, getAllBikes); // Lấy danh sách xe đạp
router.put('/v1/bike/:id/approve', isAdmin, approveBike); // Duyệt tin đăng
router.put('/v1/bike/:id/reject', isAdmin, rejectBike); // Từ chối tin đăng
router.delete('/v1/bike/:id', isAdmin, deleteBike); // Xóa tin đăng

// Quản lý người dùng
router.get('/v1/user', isAdmin, getAllUser); // Lấy danh sách người dùng
router.put('/v1/user/:id', isAdmin, updateUser); // Cập nhật thông tin người dùng
router.delete('/v1/user/:id', isAdmin, deleteUser); // Xóa người dùng

// Quản lý giao dịch
router.get('/v1/transaction', isAdmin, getAllTransaction); // Lấy danh sách giao dịch
router.put('/v1/transaction/:id', isAdmin, updateTransaction); // Cập nhật trạng thái giao dịch

// Quản lý báo cáo
router.get('/v1/report', isAdmin, getAllReports); // Lấy danh sách báo cáo
router.post('/v1/report/:id/resolve', isAdmin, resolveReport); // Giải quyết báo cáo

// Quản lý danh mục xe
router.get('/v1/category', isAdmin, getAllCategory); // Lấy danh sách danh mục
router.post('/v1/category', isAdmin, createCategory); // Thêm mới danh mục
router.put('/v1/category/:id', isAdmin, updateCategory); // Cập nhật danh mục
router.delete('/v1/category/:id', isAdmin, deleteCategory); // Xóa danh mục

export default router;