// 1. Khai báo các thư viện cần dùng
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import database config
const { pool } = require('./config/database');

// Import routes
const authRoutes = require('./routes/authRoutes');
const bikeRoutes = require('./routes/bikeRoutes');
const orderRoutes = require('./routes/orderRoutes');
const messageRoutes = require('./routes/messageRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const inspectionRoutes = require('./routes/inspectionRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

// 2. Khởi tạo App
const app = express();

// 3. Cấu hình Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Serve static files (uploaded images/videos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 4. Test Database Connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Lỗi kết nối PostgreSQL:', err);
  } else {
    console.log('✅ Đã kết nối thành công tới PostgreSQL');
  }
});

// 5. Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Chào mừng đến với API Website Kết Nối Mua Bán Xe Đạp Thể Thao Cũ',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      bikes: '/api/bikes',
      orders: '/api/orders',
      messages: '/api/messages',
      reviews: '/api/reviews',
      wishlist: '/api/wishlist',
      inspections: '/api/inspections',
      admin: '/api/admin'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bikes', bikeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/admin', adminRoutes);

// 6. Error Handling
app.use(notFound);
app.use(errorHandler);

// 7. Chạy Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📝 Môi trường: ${process.env.NODE_ENV || 'development'}`);
});