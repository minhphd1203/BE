-- Database Schema cho Website Kết Nối Mua Bán Xe Đạp Thể Thao Cũ

-- Extension for UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum Types
CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'inspector', 'admin');
CREATE TYPE bike_status AS ENUM ('active', 'sold', 'hidden', 'pending_review');
CREATE TYPE bike_condition AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');
CREATE TYPE order_status AS ENUM ('pending', 'deposit_paid', 'completed', 'cancelled');
CREATE TYPE inspection_status AS ENUM ('pending', 'in_progress', 'completed', 'rejected');

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'buyer',
    is_active BOOLEAN DEFAULT true,
    reputation_score DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bike Categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Brands
CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bikes/Listings Table
CREATE TABLE bikes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INT REFERENCES categories(id),
    brand_id INT REFERENCES brands(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL,
    condition bike_condition NOT NULL,
    status bike_status DEFAULT 'pending_review',
    frame_size VARCHAR(50),
    year_of_manufacture INT,
    weight DECIMAL(5,2),
    color VARCHAR(50),
    location VARCHAR(255),
    is_inspected BOOLEAN DEFAULT false,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bike Images
CREATE TABLE bike_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bike_id UUID NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bike Videos
CREATE TABLE bike_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bike_id UUID NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bike Specifications
CREATE TABLE bike_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bike_id UUID NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
    frame_material VARCHAR(100),
    brake_type VARCHAR(100),
    gear_system VARCHAR(100),
    wheel_size VARCHAR(50),
    suspension_type VARCHAR(100),
    usage_history TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders/Transactions
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bike_id UUID NOT NULL REFERENCES bikes(id),
    buyer_id UUID NOT NULL REFERENCES users(id),
    seller_id UUID NOT NULL REFERENCES users(id),
    total_amount DECIMAL(12,2) NOT NULL,
    deposit_amount DECIMAL(12,2),
    status order_status DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages/Chat
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id),
    receiver_id UUID NOT NULL REFERENCES users(id),
    bike_id UUID REFERENCES bikes(id),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inspections
CREATE TABLE inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bike_id UUID NOT NULL REFERENCES bikes(id),
    inspector_id UUID NOT NULL REFERENCES users(id),
    status inspection_status DEFAULT 'pending',
    frame_condition VARCHAR(50),
    brake_condition VARCHAR(50),
    drivetrain_condition VARCHAR(50),
    overall_rating DECIMAL(2,1),
    notes TEXT,
    report_url TEXT,
    inspection_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews/Ratings
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    reviewer_id UUID NOT NULL REFERENCES users(id),
    reviewee_id UUID NOT NULL REFERENCES users(id),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wishlist
CREATE TABLE wishlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bike_id UUID NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, bike_id)
);

-- Reports (for violations)
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id),
    reported_user_id UUID REFERENCES users(id),
    bike_id UUID REFERENCES bikes(id),
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Service Fees
CREATE TABLE service_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    fee_amount DECIMAL(10,2) NOT NULL,
    fee_type VARCHAR(50),
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT false,
    related_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_bikes_seller ON bikes(seller_id);
CREATE INDEX idx_bikes_status ON bikes(status);
CREATE INDEX idx_bikes_category ON bikes(category_id);
CREATE INDEX idx_bikes_brand ON bikes(brand_id);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_wishlists_user ON wishlists(user_id);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bikes_updated_at BEFORE UPDATE ON bikes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON inspections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some default categories
INSERT INTO categories (name, slug, description) VALUES
('Xe đạp đường trường', 'road-bike', 'Xe đạp đường trường, tốc độ cao'),
('Xe đạp địa hình', 'mountain-bike', 'Xe đạp leo núi, địa hình phức tạp'),
('Xe đạp touring', 'touring-bike', 'Xe đạp phượt đường dài'),
('Xe đạp fixed gear', 'fixed-gear', 'Xe đạp bánh răng cố định'),
('Xe đạp đua', 'racing-bike', 'Xe đạp chuyên đua');

-- Insert some default brands
INSERT INTO brands (name, slug) VALUES
('Giant', 'giant'),
('Trek', 'trek'),
('Specialized', 'specialized'),
('Cannondale', 'cannondale'),
('Scott', 'scott'),
('Merida', 'merida'),
('Bianchi', 'bianchi');
