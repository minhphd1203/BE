import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { client } from '../src/db';

dotenv.config();

async function seedReportReasons() {
  try {
    console.log('Seeding report reasons...');
    
    const sql = `
      -- Remove default reason if exists
      DELETE FROM "report_reasons" WHERE "name" = 'Bike Condition/Quality Issue';
      
      -- Insert report reasons
      INSERT INTO "report_reasons" ("id", "name", "description", "is_system_auto_resolvable", "auto_resolve_action", "created_at", "updated_at")
      VALUES 
        ('10000000-0000-0000-0000-000000000001'::uuid, 'Bike Quality Unmatched Reality', 'Bike received is different from seller description - misleading info or quality defect', true, 'delete_bike', now(), now())
      ON CONFLICT ("name") DO NOTHING;
    `;

    await client.unsafe(sql);
    console.log('✓ Report reasons seeded successfully');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedReportReasons();
