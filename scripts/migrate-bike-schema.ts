/**
 * Safe migration script: Move bike brand/model data to foreign keys
 * This should be run before `npm run db:push`
 */

import { db } from '../src/db';
import { bikes, brands, models } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function migrateBikeSchema() {
  console.log('🔄 Starting bike schema migration...');

  try {
    // Step 1: Get all bikes with brand/model text columns
    console.log('📖 Fetching existing bikes...');
    const existingBikes = await db.select().from(bikes);
    console.log(`Found ${existingBikes.length} bikes`);

    if (existingBikes.length === 0) {
      console.log('✅ No bikes to migrate, skipping...');
      return;
    }

    // Step 2: For each bike, ensure brand and model exist in new tables
    console.log('🔄 Migrating brands and models...');
    
    for (const bike of existingBikes) {
      if (!bike.brand || !bike.model) {
        console.warn(`⚠️  Bike ${bike.id} has missing brand or model, skipping...`);
        continue;
      }

      // Find or create brand
      let brand = await db.query.brands.findFirst({
        where: eq(brands.name, bike.brand as string),
      });

      if (!brand) {
        console.log(`  📝 Creating brand: ${bike.brand}`);
        const [newBrand] = await db
          .insert(brands)
          .values({ name: bike.brand as string })
          .returning();
        brand = newBrand;
      }

      // Find or create model for this brand
      let model = await db.query.models.findFirst({
        where: (table) => eq(table.name, bike.model as string) && eq(table.brandId, brand!.id),
      });

      if (!model) {
        console.log(`  📝 Creating model: ${bike.model} for brand ${brand.name}`);
        const [newModel] = await db
          .insert(models)
          .values({ name: bike.model as string, brandId: brand.id })
          .returning();
        model = newModel;
      }

      // Update bike with foreign keys
      console.log(`  🔗 Linking bike ${bike.id} to brand ${brand.id} and model ${model.id}`);
      await db
        .update(bikes)
        .set({ brandId: brand.id, modelId: model.id })
        .where(eq(bikes.id, bike.id));
    }

    console.log('✅ Migration completed successfully!');
    console.log('Next: Run `npm run db:push` to apply schema changes');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateBikeSchema().then(() => process.exit(0));
