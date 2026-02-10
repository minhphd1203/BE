# 🚂 Deploy lên Railway

## Bước 1: Chuẩn bị Git Repository

```powershell
# Khởi tạo git (nếu chưa có)
git init

# Add tất cả files
git add .

# Commit
git commit -m "Initial commit - Bike Exchange System API"
```

## Bước 2: Đăng ký Railway

1. Truy cập: https://railway.app/
2. Click **"Login"** hoặc **"Start a New Project"**
3. Đăng nhập bằng **GitHub** (khuyên dùng) hoặc email

## Bước 3: Tạo Project mới

### Cách 1: Deploy từ GitHub (Khuyên dùng)

1. Push code lên GitHub:

   ```powershell
   # Tạo repo mới trên GitHub (tên: BESWP)
   # Sau đó:
   git remote add origin https://github.com/YOUR_USERNAME/BESWP.git
   git branch -M main
   git push -u origin main
   ```

2. Trên Railway:
   - Click **"New Project"**
   - Chọn **"Deploy from GitHub repo"**
   - Chọn repository **BESWP**
   - Railway sẽ tự động detect Node.js và deploy

### Cách 2: Deploy trực tiếp (Nhanh hơn)

1. Trên Railway:
   - Click **"New Project"**
   - Chọn **"Deploy from GitHub repo"**
   - Hoặc chọn **"Empty Project"** rồi **"Deploy from local"**

2. Cài Railway CLI:

   ```powershell
   npm install -g @railway/cli
   ```

3. Login và deploy:
   ```powershell
   railway login
   railway init
   railway up
   ```

## Bước 4: Cấu hình Environment Variables

Sau khi tạo project, vào **Settings → Variables** và thêm:

```env
DATABASE_URL=postgresql://beswp_owner:xxxx@ep-xxxx.aws.neon.tech/beswp?sslmode=require
JWT_SECRET=your-secret-key-here
PORT=3000
NODE_ENV=production
```

**Lấy DATABASE_URL:**

- Copy từ file `.env` hiện tại của bạn (đã có sẵn từ Neon)

**JWT_SECRET:**

- Tạo mới hoặc dùng lại từ `.env` cũ

## Bước 5: Deploy!

Railway sẽ tự động:

1. ✅ Chạy `npm install`
2. ✅ Chạy `npm run build` (compile TypeScript)
3. ✅ Chạy `npm run start:prod` (start server)

## Bước 6: Lấy Public URL

1. Vào tab **"Settings"**
2. Scroll xuống **"Networking"** → **"Generate Domain"**
3. Railway sẽ tạo URL dạng: `https://your-app-name.up.railway.app`

## 🎉 XONG!

API của bạn giờ đã:

- ✅ Online 24/7
- ✅ Có URL cố định
- ✅ Tự động restart nếu crash
- ✅ Hoạt động khi bạn tắt máy

---

## 📝 Test API sau khi deploy

```bash
# Test health check
curl https://your-app-name.up.railway.app/api/health

# Test login
curl -X POST https://your-app-name.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

---

## 💰 Chi phí Railway

- **Free tier:** $5 credit/tháng (đủ dùng cho development)
- **Hobby plan:** $5/tháng (unlimited usage)
- Credit reset mỗi tháng

---

## 🔧 Troubleshooting

### Lỗi: Build failed

```powershell
# Chạy local để test build:
npm run build
npm run start:prod
```

### Lỗi: Database connection

- Kiểm tra DATABASE_URL đã set đúng chưa
- Đảm bảo Neon database đang online

### Lỗi: Port already in use

- Railway tự động set PORT env variable
- Server đang dùng `process.env.PORT || 3000` (đã OK)

---

## 📱 Update Postman Collection

Sau khi có Railway URL, update file Postman:

1. Mở `BESWP_API.postman_collection.json`
2. Find & Replace:
   - `https://acred-steamy-gilberte.ngrok-free.dev`
   - → `https://your-app-name.up.railway.app`

---

## 🔄 Auto-Deploy (GitHub)

Nếu deploy từ GitHub:

- Mỗi lần push code lên GitHub
- Railway tự động build và deploy lại
- Không cần làm gì thêm!

```powershell
# Sau khi sửa code:
git add .
git commit -m "Update feature"
git push

# Railway tự deploy trong ~2-3 phút
```
