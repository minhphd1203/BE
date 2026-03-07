-- Thêm các cột cần thiết cho Inspector feature

-- 1. Thêm cột inspection_status vào bảng bikes
ALTER TABLE bikes 
ADD COLUMN IF NOT EXISTS inspection_status varchar(50) DEFAULT 'pending';

-- 2. Thêm cột is_verified vào bảng bikes
ALTER TABLE bikes 
ADD COLUMN IF NOT EXISTS is_verified varchar(20) DEFAULT 'not_verified';

-- 3. Tạo bảng inspections
CREATE TABLE IF NOT EXISTS inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id uuid NOT NULL REFERENCES bikes(id),
  inspector_id uuid NOT NULL REFERENCES users(id),
  status varchar(50) DEFAULT 'passed' NOT NULL,
  overall_condition varchar(50) NOT NULL,
  frame_condition varchar(50),
  brake_condition varchar(50),
  drivetrain_condition varchar(50),
  wheel_condition varchar(50),
  inspection_note text,
  recommendation text,
  inspection_images text[] DEFAULT '{}',
  report_file text,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- 4. Update images column default
ALTER TABLE bikes 
ALTER COLUMN images SET DEFAULT '{}';

SELECT 'Migration completed successfully!' AS result;
