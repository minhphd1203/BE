import { db } from '../src/db';
import { users, bikes, categories } from '../src/db/schema';
import bcrypt from 'bcryptjs';

// ========== CẤU HÌNH SỐ LƯỢNG ==========
const CONFIG = {
  NUM_USERS: 20,
  NUM_CATEGORIES: 8,
  NUM_BIKES: 50,
  NUM_INSPECTORS: 3,
  DEFAULT_PASSWORD: 'Test@123'
};

// ========== HELPER FUNCTIONS ==========
const random = {
  int: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
  float: (min: number, max: number) => Math.random() * (max - min) + min,
  pick: <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)],
  picks: <T>(arr: T[], count: number): T[] => {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  },
  boolean: () => Math.random() > 0.5,
};

// Data pools
const firstNames = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Tạ', 'Mai', 'Tô'
];

const middleNames = ['Văn', 'Thị', 'Đức', 'Minh', 'Hữu', 'Thanh', 'Quang', 'Hoàng', 'Anh', 'Tuấn'];

const lastNames = [
  'An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hải', 'Hùng', 'Khang', 'Long',
  'Mai', 'Nam', 'Phong', 'Quân', 'Sơn', 'Tâm', 'Tùng', 'Vân', 'Yến', 'Linh'
];

const cities = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Nha Trang', 'Huế', 'Vũng Tàu'];

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
const statuses = ['pending', 'approved', 'rejected'];

const categoryTemplates = [
  { type: 'Road Bike', desc: 'Xe đạp đường trường, tốc độ cao' },
  { type: 'Mountain Bike', desc: 'Xe đạp địa hình, phù hợp đường núi' },
  { type: 'Hybrid Bike', desc: 'Xe đạp đa năng, kết hợp nhiều loại' },
  { type: 'City Bike', desc: 'Xe đạp đô thị, di chuyển hàng ngày' },
  { type: 'Electric Bike', desc: 'Xe đạp điện trợ lực' },
  { type: 'Gravel Bike', desc: 'Xe đạp địa hình nhẹ' },
  { type: 'BMX', desc: 'Xe đạp biểu diễn' },
  { type: 'Folding Bike', desc: 'Xe đạp gấp dễ mang theo' }
];

// Generate functions
function generateName(): string {
  return `${random.pick(firstNames)} ${random.pick(middleNames)} ${random.pick(lastNames)}`;
}

function generateEmail(name: string, index: number): string {
  const normalized = name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '.');
  return `${normalized}.${index}@example.com`;
}

function generatePhone(): string {
  return `09${random.int(10000000, 99999999)}`;
}

function generateBikeTitle(brand: string, model: string, year: number): string {
  return `${brand} ${model} ${year}`;
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
    random.boolean() ? 'Có hóa đơn VAT.' : 'Xe cá nhân không hóa đơn.',
    random.boolean() ? 'Đã bảo dưỡng định kỳ.' : ''
  ];
  
  return desc.filter(s => s).join(' ');
}

// ========== MAIN SEED FUNCTION ==========
async function seedData() {
  try {
    console.log('🌱 Bắt đầu seed data với dữ liệu ngẫu nhiên...\n');
    console.log(`📊 Cấu hình:`);
    console.log(`   - Users: ${CONFIG.NUM_USERS}`);
    console.log(`   - Inspectors: ${CONFIG.NUM_INSPECTORS}`);
    console.log(`   - Categories: ${CONFIG.NUM_CATEGORIES}`);
    console.log(`   - Bikes: ${CONFIG.NUM_BIKES}\n`);

    const hashedPassword = await bcrypt.hash(CONFIG.DEFAULT_PASSWORD, 10);

    // 1. Tạo Users
    console.log('👥 Tạo users ngẫu nhiên...');
    const userValues = [];
    for (let i = 0; i < CONFIG.NUM_USERS; i++) {
      const name = generateName();
      userValues.push({
        email: generateEmail(name, i + 1),
        password: hashedPassword,
        name,
        phone: generatePhone(),
        role: 'user',
      });
    }
    const newUsers = await db.insert(users).values(userValues).returning();
    console.log(`✓ Đã tạo ${newUsers.length} users\n`);

    // 2. Tạo Inspectors
    console.log('🔍 Tạo inspectors...');
    const inspectorValues = [];
    for (let i = 0; i < CONFIG.NUM_INSPECTORS; i++) {
      const name = `Inspector ${generateName()}`;
      inspectorValues.push({
        email: `inspector${i + 1}@beswp.com`,
        password: hashedPassword,
        name,
        phone: generatePhone(),
        role: 'inspector',
      });
    }
    const newInspectors = await db.insert(users).values(inspectorValues).returning();
    console.log(`✓ Đã tạo ${newInspectors.length} inspectors\n`);

    // 3. Tạo Categories
    console.log('📂 Tạo categories...');
    const categoryValues = categoryTemplates.slice(0, CONFIG.NUM_CATEGORIES).map(cat => ({
      name: cat.type,
      slug: cat.type.toLowerCase().replace(/\s+/g, '-'),
      description: cat.desc,
    }));
    const newCategories = await db.insert(categories).values(categoryValues).returning();
    console.log(`✓ Đã tạo ${newCategories.length} categories\n`);

    // 4. Tạo Bikes
    console.log('🚲 Tạo bikes ngẫu nhiên...');
    const bikeValues = [];
    for (let i = 0; i < CONFIG.NUM_BIKES; i++) {
      const brand = random.pick(bikeBrands);
      const model = generateBikeModel();
      const year = random.int(2018, 2024);
      const condition = random.pick(conditions);
      const city = random.pick(cities);
      const size = random.pick(sizes);
      const status = random.pick(statuses);
      
      bikeValues.push({
        title: generateBikeTitle(brand, model, year),
        description: generateDescription(brand, model, condition, city, size),
        brand,
        model,
        year,
        price: random.int(5, 100) * 1000000, // 5tr - 100tr
        condition,
        color: random.pick(colors),
        mileage: condition === 'new' ? 0 : random.int(100, 10000),
        images: [`https://picsum.photos/800/600?random=${i}`],
        status,
        categoryId: random.pick(newCategories).id,
        sellerId: random.pick(newUsers).id,
      });
    }
    const newBikes = await db.insert(bikes).values(bikeValues).returning();
    console.log(`✓ Đã tạo ${newBikes.length} bikes\n`);

    // 5. Tổng kết
    console.log('='.repeat(60));
    console.log('✅ SEED DATA THÀNH CÔNG!');
    console.log('='.repeat(60));
    console.log(`📊 Tổng kết:`);
    console.log(`   - Users: ${newUsers.length}`);
    console.log(`   - Inspectors: ${newInspectors.length}`);
    console.log(`   - Categories: ${newCategories.length}`);
    console.log(`   - Bikes: ${newBikes.length}`);
    console.log('='.repeat(60));
    console.log('\n💡 Thông tin đăng nhập:');
    console.log(`   - User mẫu: ${newUsers[0].email} / ${CONFIG.DEFAULT_PASSWORD}`);
    console.log(`   - Inspector: inspector1@beswp.com / ${CONFIG.DEFAULT_PASSWORD}`);
    console.log(`   - Tất cả account đều dùng password: ${CONFIG.DEFAULT_PASSWORD}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi seed data:', error);
    process.exit(1);
  }
}

seedData();
