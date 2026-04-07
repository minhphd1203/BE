import dotenv from 'dotenv';
dotenv.config(); // MUST be called before any other imports that use process.env

import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import authRoutes from './src/routes/authRoutes';
import adminRoutes from './src/routes/adminRoutes';
import inspectorRoutes from './src/routes/inspectorRoutes';
import buyerRoutes from './src/routes/buyerRoutes';
import sellerRoutes from './src/routes/sellerRoutes';
import paymentRoutes from './src/routes/paymentRoutes';
import profileRoutes from './src/routes/profileRoutes';
import messageRoutes from './src/routes/messageRoutes';
import fulfillmentRoutes from './src/routes/fulfillmentRoutes';
import { specs } from './src/swagger';
import { db, client } from './src/db';
import { users } from './src/db/schema';
import { eq } from 'drizzle-orm';
import { startAutoExpireJob } from './src/jobs/autoExpireTransactions';
import { startFulfillmentJobs } from './src/jobs/fulfillmentJobs';

const app = express();
const port = process.env.PORT || 3000;

const extraCorsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  if (origin.includes('ngrok')) return true;
  if (extraCorsOrigins.includes(origin)) return true;
  const appUrl = process.env.APP_URL;
  if (appUrl && origin === appUrl) return true;
  return process.env.NODE_ENV !== 'production';
}

// CORS: dùng package `cors` (preflight OPTIONS + phản chiếu Access-Control-Request-Headers nếu không set allowedHeaders).
// Tránh allowedHeaders cố định — Angular/interceptor có thể gửi thêm header → preflight fail.
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return isCorsOriginAllowed(origin)
        ? callback(null, true)
        : callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    maxAge: 86400,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ảnh/video tin đăng (upload local — dùng APP_URL trong .env để tạo link đầy đủ, vd http://localhost:3000)
const bikesUploadStatic = path.join(process.cwd(), 'uploads', 'bikes');
fs.mkdirSync(bikesUploadStatic, { recursive: true });
app.use('/uploads/bikes', express.static(bikesUploadStatic));

const inspectionsUploadStatic = path.join(process.cwd(), 'uploads', 'inspections');
fs.mkdirSync(inspectionsUploadStatic, { recursive: true });
app.use('/uploads/inspections', express.static(inspectionsUploadStatic));

const messagesUploadStatic = path.join(process.cwd(), 'uploads', 'messages');
fs.mkdirSync(messagesUploadStatic, { recursive: true });
app.use('/uploads/messages', express.static(messagesUploadStatic));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(`${color}[${res.statusCode}]\x1b[0m ${req.method} ${req.originalUrl} (${ms}ms)`);
  });
  next();
});

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚴 Bike Exchange System API',
        version: '1.0.0',
        documentation: `See full interactive docs at /api-docs`,
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login'
            },
            admin: {
                bikes: 'GET /api/admin/v1/bike',
                approveBike: 'PUT /api/admin/v1/bike/:id/approve',
                rejectBike: 'PUT /api/admin/v1/bike/:id/reject',
                deleteBike: 'DELETE /api/admin/v1/bike/:id',
                users: 'GET /api/admin/v1/user',
                updateUser: 'PUT /api/admin/v1/user/:id',
                deleteUser: 'DELETE /api/admin/v1/user/:id',
                categories: 'GET /api/admin/v1/category',
                createCategory: 'POST /api/admin/v1/category',
                updateCategory: 'PUT /api/admin/v1/category/:id',
                deleteCategory: 'DELETE /api/admin/v1/category/:id',
                transactions: 'GET /api/admin/v1/transaction',
                updateTransaction: 'PUT /api/admin/v1/transaction/:id',
                reports: 'GET /api/admin/v1/report',
                resolveReport: 'PUT /api/admin/v1/report/:id/resolve'
            },
            inspector: {
                dashboard: 'GET /api/inspector/v1/dashboard',
                pendingBikes: 'GET /api/inspector/v1/bikes/pending',
                bikeDetail: 'GET /api/inspector/v1/bikes/:bikeId',
                startInspection: 'POST /api/inspector/v1/bikes/:bikeId/start',
                submitInspection: 'POST /api/inspector/v1/bikes/:bikeId/inspect',
                myInspections: 'GET /api/inspector/v1/inspections',
                inspectionDetail: 'GET /api/inspector/v1/inspections/:inspectionId',
                updateInspection: 'PUT /api/inspector/v1/inspections/:inspectionId'
            },
            buyer: {
                searchBikes: 'GET /api/buyer/v1/bikes/search',
                bikeDetail: 'GET /api/buyer/v1/bikes/:bikeId',
                recommendedBikes: 'GET /api/buyer/v1/bikes/recommended',
                createTransaction: 'POST /api/buyer/v1/transactions',
                myTransactions: 'GET /api/buyer/v1/transactions',
                cancelTransaction: 'DELETE /api/buyer/v1/transactions/:id',
                wishlist: 'GET /api/buyer/v1/wishlist',
                addToWishlist: 'POST /api/buyer/v1/wishlist/:bikeId',
                removeFromWishlist: 'DELETE /api/buyer/v1/wishlist/:bikeId',
                submitReport: 'POST /api/buyer/v1/reports',
                addReview: 'POST /api/buyer/v1/reviews',
                sendMessage: 'POST /api/buyer/v1/messages/:sellerId',
                getMessages: 'GET /api/buyer/v1/messages/:sellerId'
            },
            payment: {
                createPaymentUrl: 'POST /api/payment/v1/create/:transactionId',
                vnpayReturn: 'GET /api/payment/v1/vnpay-return',
                vnpayIPN: 'GET /api/payment/v1/vnpay-ipn',
                paymentStatus: 'GET /api/payment/v1/status/:transactionId'
            },
            seller: {
                dashboard: 'GET /api/seller/v1/dashboard',
                categories: 'GET /api/seller/v1/categories',
                createBike: 'POST /api/seller/v1/bikes',
                myBikes: 'GET /api/seller/v1/bikes',
                bikeDetail: 'GET /api/seller/v1/bikes/:id',
                updateBike: 'PUT /api/seller/v1/bikes/:id',
                toggleVisibility: 'PUT /api/seller/v1/bikes/:id/visibility',
                deleteBike: 'DELETE /api/seller/v1/bikes/:id',
                myTransactions: 'GET /api/seller/v1/transactions',
                updateTransaction: 'PUT /api/seller/v1/transactions/:id',
                conversations: 'GET /api/seller/v1/messages',
                messageHistory: 'GET /api/seller/v1/messages/:partnerId',
                sendMessage: 'POST /api/seller/v1/messages/:partnerId',
                myReviews: 'GET /api/seller/v1/reviews'
            },
            other: {
                health: 'GET /api/health'
            }
        },
        note: 'All admin endpoints require: Authorization: Bearer <admin_token>'
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Swagger JSON spec endpoint
app.get('/api-docs/spec.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
});

// Swagger UI Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  swaggerOptions: {
    defaultModelsExpandDepth: -1,
    defaultModelExpandDepth: -1,
    defaultResponseModelsExpandDepth: -1,
  },
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inspector', inspectorRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/payment', paymentRoutes);

app.use('/api/profile', profileRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/fulfillment', fulfillmentRoutes);

// Sync migration tracking records when schema was set up via db:push (tables exist but __drizzle_migrations is empty)
async function ensureMigrationsTracked(migrationsFolder: string) {
  try {
    console.log('[DB] Syncing migration tracking...');

    // Read migration journal
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
    if (!fs.existsSync(journalPath)) {
      console.log('[DB] No migration journal found');
      return;
    }

    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
    console.log(`[DB] Found ${journal.entries.length} migrations in journal`);

    // Fetch all currently tracked migration hashes
    let trackedHashes: string[] = [];
    try {
      const result = await client`SELECT hash FROM drizzle.__drizzle_migrations`;
      trackedHashes = result.map((row: any) => row.hash);
      console.log(`[DB] Database has ${trackedHashes.length} tracked migrations`);
    } catch (e) {
      console.log('[DB] Could not query migration tracking table');
      return;
    }

    // Check if critical tables already exist (indicates db was bootstrapped via db:push)
    try {
      const [tableCheck] = await client`
        SELECT COUNT(*)::int AS count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('bikes', 'users', 'messages', 'conversation_threads')
      `;
      
      if (tableCheck.count === 4) {
        console.log('[DB] ✓ All critical tables exist - database was pre-populated via db:push');
        console.log('[DB] Marking all migrations as applied to prevent re-running...');
        
        // If we already have some tracked, mark the rest as applied without inserting
        const missingCount = journal.entries.length - trackedHashes.length;
        if (missingCount > 0) {
          console.log(`[DB] Simulating ${missingCount} migrations as applied (already exist in database)`);
        }
        return;
      }
    } catch (e) {
      // Continue with normal tracking
    }

    let inserted = 0;
    let skipped = 0;
    
    for (const entry of journal.entries) {
      const sqlFile = path.join(migrationsFolder, `${entry.tag}.sql`);
      if (!fs.existsSync(sqlFile)) {
        skipped++;
        continue;
      }

      try {
        const sqlContent = fs.readFileSync(sqlFile, 'utf-8');
        const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');
        
        // Check if this migration is already tracked
        if (trackedHashes.includes(hash)) {
          skipped++;
          continue;
        }

        // Insert the missing migration - convert timestamp to milliseconds (bigint)
        const createdAtMs = entry.when || Date.now();
        await client`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at) 
          VALUES (${hash}, ${createdAtMs})
        `;
        inserted++;
        console.log(`[DB] ✓ Marked migration ${entry.tag} as applied`);
      } catch (e) {
        // Silently skip if we can't insert (likely due to type mismatch)
        skipped++;
      }
    }

    if (inserted > 0 || skipped > 0) {
      console.log(`[DB] Migration sync complete: ${inserted} inserted, ${skipped} already tracked/skipped`);
    }
  } catch (err) {
    console.error('[DB] Migration tracking setup failed:', err instanceof Error ? err.message : err);
  }
}

async function bootstrap() {
  // Auto-migrate database on startup
  // Use process.cwd() to get project root (works in both dev and compiled dist/)
  const migrationsFolder = path.join(process.cwd(), 'drizzle');

  // Step 1: Ensure migration tracking is in sync when schema was bootstrapped via db:push
  await ensureMigrationsTracked(migrationsFolder);

  // Step 2: Check if we need to run migrations
  try {
    const [countResult] = await client`SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations`;
    const trackedCount = countResult.count;
    
    // Read journal to see how many total migrations exist
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
    if (fs.existsSync(journalPath)) {
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
      const totalMigrations = journal.entries.length;

      // Check if all critical tables exist (db was pre-populated)
      let allTablesExist = false;
      try {
        const [tableCheck] = await client`
          SELECT COUNT(*)::int AS count 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('bikes', 'users', 'messages', 'conversation_threads', 'report_reasons')
        `;
        allTablesExist = tableCheck.count >= 5;
      } catch (e) {
        // Ignore
      }

      if (allTablesExist) {
        console.log('[DB] ✓ All tables exist - database is ready');
        console.log('[DB] Skipping migration runner to prevent re-running applied migrations');
      } else if (trackedCount >= totalMigrations) {
        console.log(`[DB] ✓ All ${totalMigrations} migrations already applied - skipping migration runner`);
      } else {
        console.log(`[DB] Running migrations (${trackedCount}/${totalMigrations} tracked)...`);
        try {
          await migrate(db, { migrationsFolder });
          console.log('[DB] ✓ Migrations completed successfully');
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
          // Only log actual errors, not expected "table already exists" notices
          if (errMsg.includes('already exists') || errMsg.includes('42P07')) {
            console.log('[DB] ⓘ Some tables already exist (expected from db:push)');
          } else {
            console.error('[DB] Migration error:', errMsg);
          }
        }
      }
    }
  } catch (err) {
    console.log('[DB] Could not verify migration status - proceeding with caution');
  }

  // Seed admin user if not exists
  try {
    const existing = await db.query.users.findFirst({ where: eq(users.email, 'admin@example.com') });
    if (!existing) {
      const hashed = await bcrypt.hash('admin123', 10);
      await db.insert(users).values({
        email: 'admin@example.com',
        password: hashed,
        name: 'Admin User',
        phone: '0123456789',
        role: 'admin',
      });
      console.log('[DB] Admin user created: admin@example.com / admin123');
    } else {
      console.log('[DB] Admin user already exists.');
    }
  } catch (err) {
    console.error('[DB] Seed error:', err instanceof Error ? err.message : err);
  }

  const server = app.listen(port, () => {
    console.log(`\n🚀 Server is running at http://localhost:${port}`);
    console.log(`📚 Swagger UI:        http://localhost:${port}/api-docs`);
    console.log(`📄 Swagger JSON:      http://localhost:${port}/api-docs/spec.json\n`);

    // Start background jobs
    startAutoExpireJob();
    startFulfillmentJobs();
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${port} is already in use. Kill the existing process and retry.\n`);
      process.exit(1);
    }
    throw err;
  });

  const shutdown = async () => {
    server.close();
    await client.end();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap();

