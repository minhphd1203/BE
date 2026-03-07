# 🚴 Bike Exchange System - Backend Setup Guide

Complete guide để teammates clone project và setup database khi lần đầu tiên.

---

## 📋 Prerequisites

Cần cài đặt trước:

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **PostgreSQL** ([Download](https://www.postgresql.org/download/))
- **Postman** (Optional, để test API)
- **Git**

---

## 🚀 Step-by-Step Setup

### Step 1: Clone Project

```bash
git clone <repository-url>
cd BE
```

### Step 2: Install Dependencies

```bash
npm install
```

---

## 🗄️ Database Setup

### Step 2a: Create PostgreSQL Database

**Option 1: Using pgAdmin (GUI)**
1. Open pgAdmin
2. Right-click "Databases" → Create → Database
3. Name: `bike_exchange` (hoặc tên khác tuỳ ý)
4. Click Save

**Option 2: Using Command Line**
```bash
# Kết nối PostgreSQL
psql -U postgres

# Tạo database
CREATE DATABASE bike_exchange;

# Kiểm tra
\l

# Exit
\q
```

---

## ⚙️ Environment Setup

### Step 3: Create `.env` File

Tại thư mục root project (`BE/`), tạo file `.env`:

```bash
# .env
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/bike_exchange
JWT_SECRET=your_super_secret_key_change_this_in_production
```

**Thay đổi:**
- `YOUR_PASSWORD` → postgres password của bạn
- `bike_exchange` → tên database (nếu đặt tên khác)

---

## 📊 Database Migration & Seed

### Step 4: Push Database Schema (Create Tables)

```bash
npm run db:push
```

**Output mong đợi:**
```
✓ 5 tables created:
  - users
  - categories
  - bikes
  - transactions
  - inspections
  - reports
```

### Step 5: Seed Sample Data (Optional)

```bash
npm run seed
```

**Điều này sẽ tạo:**
- ✅ 20 Users (sellers)
- ✅ 3 Inspectors
- ✅ 8 Categories
- ✅ 50 Bikes

**Default credentials sau seeding:**
```
User Example: pham.quang.yen.1@example.com / Test@123
Inspector: inspector1@beswp.com / Test@123
```

---

## 🔧 Verify Database Connection

### Test Connection (Optional)

```bash
npx ts-node scripts/test-connection.ts
```

**Output thành công:**
```
✅ Connected to database successfully!
```

---

## 🎯 Start Server

### Step 6: Run Development Server

```bash
npm run dev
```

**Output:**
```
Server is running at http://localhost:3000
```

---

## ✅ Verify Everything Works

### Check Server Health

```bash
curl http://localhost:3000/

# Or visit in browser:
http://localhost:3000/
```

**Expected response:**
```json
{
  "success": true,
  "message": "🚴 Bike Exchange System API",
  "version": "1.0.0",
  "endpoints": {...}
}
```

---

## 🧪 Test API Endpoints

### Test with Postman

1. Open Postman
2. Import **`BUYER_FLOW.postman_collection.json`**
3. Set Environment: `BASE_URL: http://localhost:3000`
4. Run requests in order

Or manually test:

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User",
    "phone": "0123456789"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `Database connection refused` | Check PostgreSQL is running, verify DATABASE_URL in .env |
| `relation "users" does not exist` | Run `npm run db:push` to create tables |
| `duplicate key value violates unique constraint` | Run `npm run reset` to clear old data (if needed) |
| `JWT_SECRET must have a value` | Add `JWT_SECRET=...` to .env file |
| `Port 3000 already in use` | Change PORT in .env or kill process using port 3000 |
| `Module not found` | Run `npm install` again |

---

## 📁 Project Structure

```
BE/
├── src/
│   ├── controllers/     # Business logic
│   ├── routes/          # API endpoints
│   ├── middleware/      # Authentication, etc
│   ├── db/              # Database config & schema
│   └── models/          # TypeScript types
├── scripts/
│   ├── seed-data.ts     # Generate sample data
│   ├── reset-db.ts      # Clear database
│   └── migrate.ts       # Database migrations
├── .env                 # Environment variables (CREATE THIS)
├── package.json
├── server.ts            # Entry point
└── tsconfig.json
```

---

## 🔑 Available Scripts

```bash
npm run dev              # Start development server with auto-reload
npm run build            # Build TypeScript to JavaScript
npm run start            # Run production server
npm run db:push          # Create/update tables in database
npm run db:generate      # Generate migration files
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio (database GUI)
npm run seed             # Seed sample data
npm run reset            # Reset database (clear all data)
npm run create-inspector # Create new inspector account
```

---

## 📚 API Documentation

- **Auth & Buyer APIs:** See `BUYER_API_POSTMAN_GUIDE.md`
- **Inspector APIs:** See `INSPECTOR_API_GUIDE.md`
- **Admin APIs:** See `POSTMAN_GUIDE.md`
- **Postman Collection:** Import `BUYER_FLOW.postman_collection.json`

---

## 🤝 Team Guidelines

**Before pushing code:**
1. ✅ Database migrations are included
2. ✅ `.env.example` shows required variables (but don't commit `.env`)
3. ✅ Run `npm run seed` to verify database setup works
4. ✅ Test API endpoints with Postman

**When teammate clones:**
1. Clone repo
2. Create `.env` with correct DATABASE_URL
3. Run `npm install`
4. Run `npm run db:push`
5. Run `npm run seed` (optional)
6. Run `npm run dev`
7. Ready to code! 🎉

---

## ❓ Need Help?

Check documentation:
- `BUYER_API_POSTMAN_GUIDE.md` - Buyer API tests
- `INSPECTOR_API_GUIDE.md` - Inspector API documentation
- `POSTMAN_GUIDE.md` - Admin & general API guide

Or ask team lead!

---

**Last Updated:** March 7, 2026
**Version:** 1.0.0
