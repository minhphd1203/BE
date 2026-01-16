-- Sample data để test hệ thống

-- Lưu ý: Chạy file này SAU KHI đã chạy schema.sql

-- 1. Tạo một số users mẫu (password: 123456)
-- Password hash cho '123456': $2a$10$YourHashHere

-- Admin user
INSERT INTO users (email, password_hash, full_name, phone, role) VALUES
('admin@bikemarketplace.com', '$2a$10$qXEZ.VW8U8Tm3/sJPnBQxeZGZvGGz5Y3qXEZ.VW8U8Tm3/sJPnBQxe', 'Admin System', '0900000000', 'admin');

-- Seller users
INSERT INTO users (email, password_hash, full_name, phone, role) VALUES
('seller1@example.com', '$2a$10$qXEZ.VW8U8Tm3/sJPnBQxeZGZvGGz5Y3qXEZ.VW8U8Tm3/sJPnBQxe', 'Nguyễn Văn Seller', '0901111111', 'seller'),
('seller2@example.com', '$2a$10$qXEZ.VW8U8Tm3/sJPnBQxeZGZvGGz5Y3qXEZ.VW8U8Tm3/sJPnBQxe', 'Trần Thị Bích', '0902222222', 'seller');

-- Buyer users
INSERT INTO users (email, password_hash, full_name, phone, role) VALUES
('buyer1@example.com', '$2a$10$qXEZ.VW8U8Tm3/sJPnBQxeZGZvGGz5Y3qXEZ.VW8U8Tm3/sJPnBQxe', 'Lê Văn Buyer', '0903333333', 'buyer'),
('buyer2@example.com', '$2a$10$qXEZ.VW8U8Tm3/sJPnBQxeZGZvGGz5Y3qXEZ.VW8U8Tm3/sJPnBQxe', 'Phạm Thị Mai', '0904444444', 'buyer');

-- Inspector user
INSERT INTO users (email, password_hash, full_name, phone, role) VALUES
('inspector@bikemarketplace.com', '$2a$10$qXEZ.VW8U8Tm3/sJPnBQxeZGZvGGz5Y3qXEZ.VW8U8Tm3/sJPnBQxe', 'Kiểm Định Viên', '0905555555', 'inspector');

-- 2. Thêm một số bikes mẫu (cần lấy seller_id từ users table)
-- Lưu ý: Thay thế seller_id bằng UUID thực tế từ users table

-- Example query để lấy seller_id:
-- SELECT id FROM users WHERE email = 'seller1@example.com';

-- Sau đó insert bikes:
/*
INSERT INTO bikes (seller_id, category_id, brand_id, title, description, price, condition, frame_size, year_of_manufacture, color, location, status) VALUES
('seller-uuid-here', 1, 1, 'Giant TCR Advanced Pro - Xe đạp đua Carbon', 'Xe đạp đua Giant TCR Advanced Pro, khung carbon cao cấp, groupset Shimano 105, bánh xe fulcrum, đã qua sử dụng 6 tháng, tình trạng 95%.', 25000000, 'like_new', '52cm', 2023, 'Đen/Đỏ', 'Quận 1, TP.HCM', 'active'),
('seller-uuid-here', 2, 2, 'Trek Marlin 7 - MTB 29 inch', 'Xe đạp địa hình Trek Marlin 7, bánh 29 inch, phuộc hơi RockShox, 2x10 speeds, rất phù hợp cho trail và XC.', 18000000, 'good', 'L', 2022, 'Xanh dương', 'Quận Tân Bình, TP.HCM', 'active');
*/

-- 3. Một số script utility

-- Xem tổng số users theo role:
-- SELECT role, COUNT(*) FROM users GROUP BY role;

-- Xem bikes active:
-- SELECT id, title, price, status FROM bikes WHERE status = 'active';

-- Xem orders:
-- SELECT o.id, b.title, buyer.full_name as buyer, seller.full_name as seller, o.status 
-- FROM orders o 
-- JOIN bikes b ON o.bike_id = b.id
-- JOIN users buyer ON o.buyer_id = buyer.id
-- JOIN users seller ON o.seller_id = seller.id;
