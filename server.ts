import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './src/routes/authRoutes';
import adminRoutes from './src/routes/adminRoutes';

// Load environment variables (only in development)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

