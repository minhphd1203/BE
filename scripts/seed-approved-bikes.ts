import { db } from '../src/db';
import { bikes, users, categories } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

async function seedBikes() {
  try {
    console.log('🚴 Seeding 10 bikes for seller@beswp.com...\n');

    // 1. Find seller
    const seller = await db.query.users.findFirst({
      where: eq(users.email, 'seller@beswp.com'),
    });

    if (!seller) {
      console.error('❌ Seller not found: seller@beswp.com');
      process.exit(1);
    }

    console.log(`✅ Found seller: ${seller.name} (${seller.id})`);

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

    const insertedBikes = await db
      .insert(bikes)
      .values(
        bikeData.map((bike) => ({
          ...bike,
          sellerId: seller.id,
          categoryId,
          status: 'approved',
          isVerified: 'verified', // Pass inspection
          inspectionStatus: 'completed',
          images: ['https://via.placeholder.com/600x400?text=' + bike.brand],
        }))
      )
      .returning();

    console.log(`\n✅ Successfully seeded ${insertedBikes.length} bikes!\n`);

    // Show summary
    insertedBikes.forEach((bike, index) => {
      console.log(`${index + 1}. ${bike.title}`);
      console.log(`   Brand: ${bike.brand} | Model: ${bike.model} | Price: ${bike.price.toLocaleString('vi-VN')} ₫`);
      console.log(`   Status: ${bike.status} | Verified: ${bike.isVerified} | Inspection: ${bike.inspectionStatus}`);
      console.log(`   ID: ${bike.id}\n`);
    });

    console.log('📊 Summary:');
    console.log(`   Seller: ${seller.email}`);
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
