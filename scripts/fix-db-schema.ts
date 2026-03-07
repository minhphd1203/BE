import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

async function addColumns() {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    console.log('✍️ Adding inspection_status column...');
    await sql`ALTER TABLE bikes ADD COLUMN IF NOT EXISTS inspection_status varchar(50) DEFAULT 'pending'`;
    console.log('✅ inspection_status added!');

    console.log('✍️ Adding is_verified column...');
    await sql`ALTER TABLE bikes ADD COLUMN IF NOT EXISTS is_verified varchar(20) DEFAULT 'not_verified'`;
    console.log('✅ is_verified added!');

    console.log('✍️ Creating inspections table...');
    await sql`
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
      )
    `;
    console.log('✅ inspections table created!');

    console.log('\n✅ ALL DONE! Database updated successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

addColumns();
