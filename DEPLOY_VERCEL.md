# 🚀 Deploy Backend lên Vercel

## ✅ Đã chuẩn bị:
- [x] File `vercel.json` - Config Vercel
- [x] File `.vercelignore` - Ignore files không cần deploy
- [x] Vercel CLI đã cài đặt

---

## 📝 Các bước deploy:

### Bước 1: Setup Database trên Neon (PostgreSQL Serverless)

1. **Đăng ký Neon** (miễn phí):
   - Truy cập: https://neon.tech
   - Sign up với GitHub/Google
   
2. **Tạo Database mới**:
   - Click "Create a project"
   - Chọn region gần nhất (Singapore)
   - Database name: `bicycle_marketplace`
   - Click "Create project"

3. **Lấy Connection String**:
   - Copy **Connection string** (dạng: `postgresql://user:pass@host/db?sslmode=require`)
   - Lưu lại, sẽ dùng sau

4. **Import Schema vào Neon**:
   ```bash
   # Thay YOUR_NEON_CONNECTION_STRING bằng connection string vừa copy
   psql "YOUR_NEON_CONNECTION_STRING" -f database/schema.sql
   psql "YOUR_NEON_CONNECTION_STRING" -f database/sample_data.sql
   ```

---

### Bước 2: Deploy lên Vercel

#### 2.1. Login Vercel CLI
```bash
vercel login
```
- Chọn email để nhận link verify
- Click link trong email để xác thực

#### 2.2. Deploy
```bash
cd D:\be
vercel
```

Trả lời các câu hỏi:
- **Set up and deploy?** → `Y`
- **Which scope?** → Chọn account của bạn
- **Link to existing project?** → `N`
- **What's your project's name?** → `bicycle-marketplace-api`
- **In which directory is your code located?** → `.` (enter)
- **Want to override the settings?** → `N`

#### 2.3. Setup Environment Variables

Sau khi deploy lần đầu, add environment variables:

```bash
vercel env add DB_HOST
vercel env add DB_PORT
vercel env add DB_NAME
vercel env add DB_USER
vercel env add DB_PASSWORD
vercel env add JWT_SECRET
```

Hoặc add qua Vercel Dashboard:
1. Vào https://vercel.com/dashboard
2. Chọn project `bicycle-marketplace-api`
3. Settings → Environment Variables
4. Add từng biến:
   - `DB_HOST` = (từ Neon connection string)
   - `DB_PORT` = `5432`
   - `DB_NAME` = `bicycle_marketplace`
   - `DB_USER` = (từ Neon)
   - `DB_PASSWORD` = (từ Neon)
   - `JWT_SECRET` = `your-super-secret-jwt-key-change-this`
   - `NODE_ENV` = `production`

#### 2.4. Redeploy với environment variables
```bash
vercel --prod
```

---

### Bước 3: Test API trên Production

Sau khi deploy xong, Vercel sẽ cho bạn URL dạng:
```
https://bicycle-marketplace-api.vercel.app
```

Test các endpoints:
- Homepage: `https://bicycle-marketplace-api.vercel.app/`
- Swagger: `https://bicycle-marketplace-api.vercel.app/api-docs`
- API: `https://bicycle-marketplace-api.vercel.app/api/auth/login`

---

## 🔄 Cập nhật code sau này

Mỗi khi có thay đổi code:

```bash
# Deploy preview
vercel

# Deploy production
vercel --prod
```

---

## 🎯 Setup Custom Domain (Optional)

1. Vào Vercel Dashboard → Project → Settings → Domains
2. Add domain của bạn (vd: `api.bicyclemarketplace.com`)
3. Configure DNS theo hướng dẫn của Vercel

---

## ⚠️ Lưu ý quan trọng:

### 1. Serverless Limitations
Vercel sử dụng serverless functions:
- ⏱️ Timeout: 10s (Hobby plan) / 60s (Pro plan)
- 💾 Memory: 1024 MB
- 📦 Payload: 4.5 MB

### 2. File Uploads
Uploads folder không persistent trên Vercel (serverless). Nên dùng:
- **Cloudinary** (free tier: 25GB)
- **AWS S3**
- **Vercel Blob Storage**

### 3. WebSocket
Vercel không support WebSocket persistent connections. Nếu cần real-time, dùng:
- **Pusher**
- **Ably**
- Hoặc deploy WebSocket server riêng

### 4. Database Connection Pooling
Neon tự động handle connection pooling, không cần lo

---

## 🐛 Troubleshooting

### Lỗi "Error: connect ETIMEDOUT"
→ Check connection string Neon có đúng không
→ Verify environment variables trên Vercel

### Lỗi "Module not found"
→ Chạy `npm install` và deploy lại

### API timeout
→ Optimize queries
→ Upgrade Vercel plan nếu cần timeout lâu hơn

---

## 📊 Monitor & Logs

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Deployments**: Xem lịch sử deploy
- **Analytics**: Traffic và performance
- **Logs**: Runtime logs (Functions tab)

---

## 🎉 Sau khi deploy xong:

✅ Backend API chạy trên: `https://bicycle-marketplace-api.vercel.app`  
✅ Swagger docs: `https://bicycle-marketplace-api.vercel.app/api-docs`  
✅ Auto SSL/HTTPS  
✅ Global CDN  
✅ Automatic Git deployments (nếu link với GitHub)

---

## Alternative: Deploy lên Railway (có PostgreSQL built-in)

Nếu gặp vấn đề với Vercel + Neon, có thể thử Railway:
1. https://railway.app
2. Deploy from GitHub
3. Add PostgreSQL service
4. Link database với app
5. Done!

Railway ưu điểm:
- Built-in PostgreSQL
- Persistent storage
- No serverless limitations
- Free tier: $5 credit/month
