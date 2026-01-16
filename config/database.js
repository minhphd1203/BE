const { Pool } = require('pg');
require('dotenv').config();

// Tạo connection pool cho PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bicycle_marketplace',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Số lượng connection tối đa
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Đã kết nối thành công tới PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Lỗi PostgreSQL:', err);
  process.exit(-1);
});

// Helper function để query
const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query
};
