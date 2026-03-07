import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './src/routes/authRoutes';
import adminRoutes from './src/routes/adminRoutes';
import inspectorRoutes from './src/routes/inspectorRoutes';
import buyerRoutes from './src/routes/buyerRoutes';
import { specs } from './src/swagger';

// Load environment variables
dotenv.config();

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
                searchBikes: 'GET /api/buyer/v1/bikes/search?brand=&model=&minPrice=&maxPrice=&condition=&page=&limit=',
                bikeDetail: 'GET /api/buyer/v1/bikes/:bikeId',
                recommendedBikes: 'GET /api/buyer/v1/bikes/recommended?limit='
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

// Swagger UI Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/inspector', inspectorRoutes);
app.use('/api/buyer', buyerRoutes);

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

