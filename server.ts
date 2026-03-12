import dotenv from 'dotenv';
dotenv.config(); // MUST be called before any other imports that use process.env

import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';
import bcrypt from 'bcryptjs';
import authRoutes from './src/routes/authRoutes';
import adminRoutes from './src/routes/adminRoutes';
import inspectorRoutes from './src/routes/inspectorRoutes';
import buyerRoutes from './src/routes/buyerRoutes';
import sellerRoutes from './src/routes/sellerRoutes';
import paymentRoutes from './src/routes/paymentRoutes';
import { specs } from './src/swagger';
import { db } from './src/db';
import { users } from './src/db/schema';
import { eq } from 'drizzle-orm';

const app = express();
const port = process.env.PORT || 3000;

// Middleware - Manual CORS to ensure preflight works
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, content-type, authorization, Accept, X-Requested-With');
  res.header('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login'
            },
            bikes: {
                getAll: 'GET /api/admin/bikes',
                approve: 'PUT /api/admin/bikes/:id/approve',
                reject: 'PUT /api/admin/bikes/:id/reject',
                delete: 'DELETE /api/admin/bikes/:id'
            },
            users: {
                getAll: 'GET /api/admin/users',
                update: 'PUT /api/admin/users/:id',
                delete: 'DELETE /api/admin/users/:id'
            },
            categories: {
                getAll: 'GET /api/admin/categories',
                create: 'POST /api/admin/categories',
                update: 'PUT /api/admin/categories/:id',
                delete: 'DELETE /api/admin/categories/:id'
            },
            transactions: {
                getAll: 'GET /api/admin/transactions',
                update: 'PUT /api/admin/transactions/:id'
            },
            reports: {
                getAll: 'GET /api/admin/reports',
                resolve: 'PUT /api/admin/reports/:id/resolve'
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
        note: 'All admin endpoints require: Authorization: Bearer <token>',
        documentation: 'See POSTMAN_GUIDE.md or PUBLIC_API_ACCESS.md'
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
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inspector', inspectorRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/payment', paymentRoutes);

async function bootstrap() {
  // Auto-migrate database on startup
  // Use process.cwd() to get project root (works in both dev and compiled dist/)
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  try {
    console.log(`[DB] Running migrations from: ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });
    console.log('[DB] Migrations completed.');
  } catch (err) {
    console.error('[DB] Migration error:', err instanceof Error ? err.message : err);
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

  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

bootstrap();

