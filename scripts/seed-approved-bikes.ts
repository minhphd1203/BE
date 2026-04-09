import { db } from '../src/db';
import { bikes, users, categories, brands, models } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { client } from '../src/db';

dotenv.config();

// Helper function to get uploaded bike images
function getUploadedBikeImages(): string[] {
  const uploadsDir = path.join(__dirname, '../uploads/bikes');
  
  // Check if directory exists
  if (!fs.existsSync(uploadsDir)) {
    console.log('⚠️  uploads/bikes directory not found, using placeholder images');
    return [];
  }
  
  const files = fs.readdirSync(uploadsDir);
  
  // Filter only image files and map them to URLs
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  });

  console.log(`📸 Found ${imageFiles.length} bike images in uploads folder\n`);
  
  return imageFiles.map(file => `/uploads/bikes/${file}`);
}

// Helper function for random selections
const random = {
  int: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
  pick: <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)],
  picks: <T>(arr: T[], count: number): T[] => {
    if (arr.length === 0) return [];
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, arr.length));
  },
};

async function seedBikes() {
  try {
    console.log('🚴 Seeding 10 bikes for seller@beswp.com...\n');

    // 1. Create or find seller user
    console.log('👤 Setting up seller user...');
    let sellerUser;
    
    try {
      // First try to find existing user
      const existing = await db.select().from(users).where(eq(users.email, 'seller@beswp.com'));
      if (existing.length > 0) {
        sellerUser = existing[0];
        console.log(`✅ Using existing seller: ${sellerUser.name} (${sellerUser.email})`);
      } else {
        // Create new seller if doesn't exist
        const hashedPassword = await bcrypt.hash('Test@123', 10);
        const [newSeller] = await db.insert(users).values({
          email: 'seller@beswp.com',
          password: hashedPassword,
          name: 'Test Seller',
          phone: '0987654321',
          role: 'user'
        }).returning();
        
        sellerUser = newSeller;
        console.log(`✅ Created seller: ${newSeller.name} (${newSeller.email})`);
      }
    } catch (err: any) {
      console.error('Error with seller:', err.message);
      throw err;
    }

    // 2. Get a category (or use null)
    const category = await db.query.categories.findFirst();
    const categoryId = category?.id || null;

    if (category) {
      console.log(`✅ Found category: ${category.name}`);
    } else {
      console.log('⚠️  No categories found, bikes will be created without category');
    }

    // 3. Create 10 bikes
    const bikeData = [
      {
        title: 'Mountain Bike Pro 2024',
        description: 'High-performance mountain bike with full suspension',
        brand: 'Giant',
        model: 'Reign Pro 29',
        year: 2024,
        price: 35000000, // VND
        condition: 'new',
        mileage: 0,
        color: 'Black',
      },
      {
        title: 'Road Bike Elite',
        description: 'Lightweight carbon road bike for speed',
        brand: 'Trek',
        model: 'Madone SLR',
        year: 2023,
        price: 45000000, // VND
        condition: 'new',
        mileage: 0,
        color: 'Silver',
      },
      {
        title: 'Urban Commuter Bike',
        description: 'Perfect for city commuting',
        brand: 'Specialized',
        model: 'Sirrus x 5',
        year: 2023,
        price: 8500000, // VND
        condition: 'like-new',
        mileage: 100,
        color: 'Blue',
      },
      {
        title: 'BMX Skateboard Bike',
        description: 'Stunt bike for tricks and jumps',
        brand: 'Sunday',
        model: 'Soundgarden Special',
        year: 2022,
        price: 3500000, // VND
        condition: 'good',
        mileage: 500,
        color: 'Red',
      },
      {
        title: 'Gravel Adventure Bike',
        description: 'All-terrain gravel bike for adventure',
        brand: 'Canyon',
        model: 'Grail CF SLX',
        year: 2024,
        price: 28000000, // VND
        condition: 'new',
        mileage: 0,
        color: 'Gray',
      },
      {
        title: 'Vintage Classic Bike',
        description: 'Restored vintage roadster',
        brand: 'Peugeot',
        model: 'PX10',
        year: 1980,
        price: 5000000, // VND
        condition: 'excellent',
        mileage: 2000,
        color: 'Cream',
      },
      {
        title: 'Electric City Bike',
        description: 'E-bike for effortless commuting',
        brand: 'Riese & Müller',
        model: 'Load 75',
        year: 2024,
        price: 55000000, // VND
        condition: 'new',
        mileage: 0,
        color: 'White',
      },
      {
        title: 'Dirt Jump Bike',
        description: 'Built for dirt jumps and tricks',
        brand: 'Kona',
        model: 'Operator',
        year: 2023,
        price: 12000000, // VND
        condition: 'good',
        mileage: 800,
        color: 'Orange',
      },
      {
        title: 'Hybrid Adventure Bike',
        description: 'Versatile hybrid for all terrain',
        brand: 'Scott',
        model: 'Sub Cross',
        year: 2023,
        price: 10000000, // VND
        condition: 'like-new',
        mileage: 150,
        color: 'Green',
      },
      {
        title: 'Track Racing Bike',
        description: 'Fixed gear track bike',
        brand: 'Cinelli',
        model: 'Mash',
        year: 2022,
        price: 18000000, // VND
        condition: 'excellent',
        mileage: 300,
        color: 'Matte Black',
      },
    ];

    // Get or create brands and models
    console.log('\n📦 Kiểm tra/tạo brands và models...');
    const brandMap = new Map<string, string>();
    const modelMap = new Map<string, string>();
    
    // Collect unique brands from bike data
    const uniqueBrands = Array.from(new Set(bikeData.map(b => b.brand)));
    
    for (const brandName of uniqueBrands) {
      let brandRecord = await db.query.brands.findFirst({
        where: sql`LOWER(${brands.name}) = LOWER(${brandName})`
      });
      
      if (!brandRecord) {
        const [newBrand] = await db.insert(brands).values({
          name: brandName,
          description: `Brand: ${brandName}`
        }).returning();
        brandRecord = newBrand;
      }
      
      brandMap.set(brandName, brandRecord.id);
    }
    
    console.log(`✓ Brands ready: ${brandMap.size} brands`);
    
    // Get uploaded images
    const uploadedImages = getUploadedBikeImages();
    
    // Process bikes and resolve brand/model IDs
    const processedBikes = [];
    for (const bike of bikeData) {
      const brandId = brandMap.get(bike.brand)!;
      const modelKey = `${bike.brand}_${bike.model}`;
      let modelId = modelMap.get(modelKey);
      
      if (!modelId) {
        let existingModel = await db.query.models.findFirst({
          where: sql`${models.brandId} = ${brandId}::uuid AND LOWER(${models.name}) = LOWER(${bike.model})`
        });
        
        if (!existingModel) {
          const [newModel] = await db.insert(models).values({
            brandId,
            name: bike.model,
            description: `Model: ${bike.model}`
          }).returning();
          existingModel = newModel;
        }
        
        modelId = existingModel.id;
        modelMap.set(modelKey, modelId);
      }
      
      // Select 1-3 random images from uploaded images (or use placeholder if none uploaded)
      let bikeImages = [];
      if (uploadedImages.length > 0) {
        const numImages = random.int(1, Math.min(3, uploadedImages.length));
        bikeImages = random.picks(uploadedImages, numImages);
      } else {
        bikeImages = [`https://via.placeholder.com/600x400?text=${bike.brand}`];
      }
      
      processedBikes.push({
        title: bike.title,
        description: bike.description,
        brandId,
        modelId,
        year: bike.year,
        price: bike.price,
        condition: bike.condition,
        mileage: bike.mileage,
        color: bike.color,
        sellerId: sellerUser.id,
        categoryId,
        status: 'approved',
        isVerified: 'verified',
        inspectionStatus: 'completed',
        images: bikeImages,
      });
    }

    const insertedBikes = [];
    
    // Build a map of getBrand and getModel for fetching names
    const getBrandNameById = new Map<string, string>();
    const getModelNameById = new Map<string, string>();
    
    for (const [brandName, brandId] of brandMap) {
      getBrandNameById.set(brandId, brandName);
    }
    for (const [modelKey, modelId] of modelMap) {
      // Extract model name from modelKey (format: "BrandName_ModelName")
      const [, modelName] = modelKey.split('_');
      getModelNameById.set(modelId, modelName);
    }
    
    for (let i = 0; i < processedBikes.length; i++) {
      try {
        console.log(`\n🚲 Inserting bike ${i + 1}/10: ${processedBikes[i].title}`);
        const bike = processedBikes[i];
        
        // Get brand and model names for backward compatibility
        const brandName = getBrandNameById.get(bike.brandId) || 'Unknown';
        const modelName = getModelNameById.get(bike.modelId) || 'Unknown';
        
        // Use raw SQL client to insert
        const result = await client`
          INSERT INTO bikes (
            title, description, brand, model, brand_id, model_id, year, price, 
            condition, mileage, color, images, status, is_verified, 
            inspection_status, category_id, seller_id
          ) VALUES (
            ${bike.title}, ${bike.description}, ${brandName}, ${modelName},
            ${bike.brandId}, ${bike.modelId}, ${bike.year}, ${bike.price}, 
            ${bike.condition}, ${bike.mileage}, ${bike.color}, ${bike.images}, 
            ${bike.status}, ${bike.isVerified}, ${bike.inspectionStatus}, 
            ${bike.categoryId}, ${bike.sellerId}
          ) RETURNING *;
        `;
        
        insertedBikes.push(result[0]);
        console.log(`   ✅ Successfully inserted (ID: ${result[0].id})`);
      } catch (insertErr: any) {
        console.error(`   ❌ Failed to insert: ${insertErr.message}`);
        throw insertErr;
      }
    }

    console.log(`\n✅ Successfully seeded ${insertedBikes.length} bikes!\n`);

    // Show summary
    insertedBikes.forEach((bike, index) => {
      console.log(`${index + 1}. ${bike.title}`);
      console.log(`   Price: ${bike.price.toLocaleString('vi-VN')} ₫`);
      console.log(`   Status: ${bike.status} | Verified: ${bike.isVerified} | Inspection: ${bike.inspectionStatus}`);
      console.log(`   ID: ${bike.id}\n`);
    });

    console.log('📊 Summary:');
    console.log(`   Seller: ${sellerUser.email}`);
    console.log(`   Bikes created: ${insertedBikes.length}`);
    console.log(`   Total value: ${insertedBikes.reduce((sum, b) => sum + b.price, 0).toLocaleString('vi-VN')} ₫`);
    console.log(`   All Status: approved`);
    console.log(`   All Verified: yes (passed inspection)`);
    console.log(`   All Inspection Status: completed`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedBikes();
