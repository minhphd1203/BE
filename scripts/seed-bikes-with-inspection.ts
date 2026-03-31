import { db } from '../src/db';
import { users, bikes, categories, inspections } from '../src/db/schema';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// ========== CONFIG ==========
const CONFIG = {
  NUM_BIKES: 10,
  DEFAULT_PASSWORD: 'Test@123'
};

// ========== HELPER FUNCTIONS ==========
const random = {
  int: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
  pick: <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)],
  picks: <T>(arr: T[], count: number): T[] => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, arr.length));
  },
};

// Data pools
const bikeBrands = [
  'Giant', 'Trek', 'Specialized', 'Cannondale', 'Merida', 'Scott', 'Bianchi', 'Colnago',
  'Pinarello', 'Cervelo', 'BMC', 'Canyon', 'Cube', 'Focus', 'Fuji', 'Kona', 'Santa Cruz'
];

const modelPrefixes = ['Pro', 'Elite', 'Sport', 'Advanced', 'Comp', 'Expert', 'Team', 'SL', 'Ultimate'];
const modelSuffixes = ['X', 'XT', 'Pro', 'Disc', 'Carbon', 'Alloy', 'Race', 'Tour', 'Urban'];

const colors = [
  'Đen', 'Trắng', 'Đỏ', 'Xanh dương', 'Xanh lá', 'Vàng', 'Cam', 'Xám', 'Bạc', 'Nâu',
  'Đen/Trắng', 'Đỏ/Đen', 'Xanh/Trắng', 'Vàng/Đen', 'Xám/Cam'
];

const conditions = ['excellent', 'good', 'fair', 'poor'];
const sizes = ['XS', 'S', 'M', 'L', 'XL'];
const cities = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Nha Trang', 'Huế', 'Vũng Tàu'];

const overallConditions = ['excellent', 'good', 'fair', 'poor'];

// Get uploaded bike images
function getUploadedBikeImages(): string[] {
  const uploadsDir = path.join(__dirname, '../uploads/bikes');
  const files = fs.readdirSync(uploadsDir);
  
  // Filter only image files and map them to URLs
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  });

  console.log(`📸 Found ${imageFiles.length} bike images in uploads folder`);
  
  return imageFiles.map(file => `/uploads/bikes/${file}`);
}

function generateBikeModel(): string {
  return `${random.pick(modelPrefixes)} ${random.int(100, 999)} ${random.pick(modelSuffixes)}`;
}

function generateDescription(brand: string, model: string, condition: string, city: string, size: string): string {
  const features = [
    'Khung nhôm nhẹ',
    'Khung carbon cao cấp',
    'Bộ truyền động Shimano',
    'Bộ truyền động SRAM',
    'Phanh đĩa thủy lực',
    'Phanh V-brake',
    'Bánh 700c',
    'Bánh 29 inch',
    'Phuộc khí',
    'Yên da cao cấp'
  ];
  
  const desc = [
    `Xe ${brand} ${model} tình trạng ${condition}.`,
    `Đặc điểm: ${random.picks(features, random.int(2, 4)).join(', ')}.`,
    `Địa điểm: ${city}. Size: ${size}.`,
    'Xe được kiểm tra và xác minh bởi inspector.',
  ];
  
  return desc.filter(s => s).join(' ');
}

// ========== MAIN SEED FUNCTION ==========
async function seedBikesWithInspection() {
  try {
    console.log('🌱 Bắt đầu seed bikes với inspection status = completed...\n');
    console.log(`📊 Cấu hình:`);
    console.log(`   - Bikes: ${CONFIG.NUM_BIKES}`);
    console.log(`   - Status: approved`);
    console.log(`   - Inspector Status: completed\n`);

    // 1. Get or create seller
    console.log('👤 Kiểm tra/tạo seller...');
    let seller = (await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, 'seller@beswp.com')
    })) as any;

    if (!seller) {
      const hashedPassword = await bcrypt.hash(CONFIG.DEFAULT_PASSWORD, 10);
      const newSellers = await db.insert(users).values({
        email: 'seller@beswp.com',
        password: hashedPassword,
        name: 'Seller Test',
        phone: '0901234567',
        role: 'user',
      }).returning();
      seller = newSellers[0];
      console.log(`✓ Tạo mới seller: ${seller.email}`);
    } else {
      console.log(`✓ Seller đã tồn tại: ${seller.email}`);
    }

    // 2. Get or create inspector
    console.log('🔍 Kiểm tra/tạo inspector...');
    let inspector = (await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, 'inspector@example.com')
    })) as any;

    if (!inspector) {
      const hashedPassword = await bcrypt.hash(CONFIG.DEFAULT_PASSWORD, 10);
      const newInspectors = await db.insert(users).values({
        email: 'inspector@example.com',
        password: hashedPassword,
        name: 'Inspector Demo',
        phone: '0909876543',
        role: 'inspector',
      }).returning();
      inspector = newInspectors[0];
      console.log(`✓ Tạo mới inspector: ${inspector.email}`);
    } else {
      console.log(`✓ Inspector đã tồn tại: ${inspector.email}`);
    }

    // 3. Get categories
    console.log('📂 Lấy danh sách categories...');
    const allCategories = await db.query.categories.findMany();
    if (allCategories.length === 0) {
      console.log('❌ Không có categories! Hãy chạy seed-data.ts trước.');
      process.exit(1);
    }
    console.log(`✓ Tìm thấy ${allCategories.length} categories`);

    // 4. Get uploaded images
    console.log('📸 Lấy danh sách ảnh từ uploads...');
    const uploadedImages = getUploadedBikeImages();
    if (uploadedImages.length === 0) {
      console.log('❌ Không có ảnh trong thư mục uploads/bikes!');
      process.exit(1);
    }

    // 5. Create bikes with completed inspection status
    console.log(`🚲 Tạo ${CONFIG.NUM_BIKES} bikes với inspection status = completed...\n`);
    const bikeValues = [];
    for (let i = 0; i < CONFIG.NUM_BIKES; i++) {
      const brand = random.pick(bikeBrands);
      const model = generateBikeModel();
      const year = random.int(2018, 2024);
      const condition = random.pick(conditions);
      const city = random.pick(cities);
      const size = random.pick(sizes);
      const color = random.pick(colors);
      
      // Select 1-3 random images for this bike
      const numImages = random.int(1, 3);
      const bikeImages = random.picks(uploadedImages, numImages);
      
      bikeValues.push({
        title: `${brand} ${model} ${year} - ${color}`,
        description: generateDescription(brand, model, condition, city, size),
        brand,
        model,
        year,
        price: random.int(1, 6) * 1000000, // 1tr - 6tr
        condition,
        color,
        mileage: condition === 'excellent' ? 0 : random.int(100, 10000),
        images: bikeImages,
        status: 'approved', // Approved status
        isVerified: 'verified',
        inspectionStatus: 'completed', // COMPLETED inspection status
        categoryId: random.pick(allCategories).id,
        sellerId: seller.id,
      });
    }

    const newBikes = await db.insert(bikes).values(bikeValues).returning();
    console.log(`✓ Đã tạo ${newBikes.length} bikes\n`);

    // 6. Create inspection records for each bike
    console.log('🔍 Tạo inspection records cho từng bike...');
    const inspectionValues = newBikes.map((bike) => ({
      bikeId: bike.id,
      inspectorId: inspector.id,
      status: 'passed' as const,
      overallCondition: random.pick(overallConditions),
      frameCondition: random.pick(overallConditions),
      brakeCondition: random.pick(overallConditions),
      drivetrainCondition: random.pick(overallConditions),
      wheelCondition: random.pick(overallConditions),
      inspectionNote: 'Xe đã được kiểm tra và xác minh thành công.',
      recommendation: 'Xe trong tình trạng tốt, nên mua.',
      inspectionImages: [],
    }));

    const newInspections = await db.insert(inspections).values(inspectionValues).returning();
    console.log(`✓ Đã tạo ${newInspections.length} inspection records\n`);

    // 7. Summary
    console.log('='.repeat(60));
    console.log('✅ SEED BIKES THÀNH CÔNG!');
    console.log('='.repeat(60));
    console.log(`📊 Tổng kết:`);
    console.log(`   - Bikes: ${newBikes.length}`);
    console.log(`   - Status: approved`);
    console.log(`   - Inspection Status: completed`);
    console.log(`   - Inspection Records: ${newInspections.length}`);
    console.log('='.repeat(60));
    console.log('\n📝 Chi tiết bikes tạo ra:\n');
    
    newBikes.forEach((bike, index) => {
      console.log(`${index + 1}. ${bike.title}`);
      console.log(`   - ID: ${bike.id}`);
      console.log(`   - Giá: ${(bike.price as any).toLocaleString('vi-VN')} VND`);
      console.log(`   - Tình trạng: ${bike.condition}`);
      console.log(`   - Năm: ${bike.year}`);
      console.log(`   - Ảnh: ${(bike.images as any).length} cái`);
      console.log(`   - Inspection Status: ${bike.inspectionStatus}\n`);
    });

    console.log('💡 Thông tin đăng nhập:');
    console.log(`   - Seller: ${seller.email} / ${CONFIG.DEFAULT_PASSWORD}`);
    console.log(`   - Inspector: ${inspector.email} / ${CONFIG.DEFAULT_PASSWORD}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi seed bikes:', error);
    process.exit(1);
  }
}

seedBikesWithInspection();
