# YASHOTH ENTERPRISES ERP — PRODUCTION DEPLOYMENT GUIDE

**Version:** v1.0.0-PROD  
**Target Environments:** Termux (Android), Dedicated Linux Server (Ubuntu/Debian), Docker Container, Cloud (Vercel / Netlify / Self-Hosted Supabase)  

---

## 1. Prerequisites & Stack Overview

- **Runtime:** Node.js v18.0.0+ (Tested through v26.4.0)
- **Package Manager:** `pnpm` (Recommended) or `npm`
- **Database:** PostgreSQL 15+ / Supabase (Hosted or Self-Hosted)
- **Frontend Stack:** React 19, TypeScript 5.8, Vite, Tailwind CSS, Lucide Icons
- **Service Worker / PWA:** Standalone installable PWA with offline caching

---

## 2. Environment Variables Configuration

Create a `.env` file in the root directory based on `.env.example`:

```env
# Application Mode
NODE_ENV=production

# Supabase Authentication & PostgreSQL RLS
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# NEVER expose SUPABASE_SERVICE_ROLE_KEY to client bundle!

# Multi-Company Default Context
VITE_DEFAULT_COMPANY_ID=a0000000-0000-0000-0000-000000000001
VITE_PRIMARY_COMPANY_CODE=YE-MAIN

# Google Drive Cloud Backup (Optional)
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_GOOGLE_DRIVE_BACKUP_FOLDER=Yashoth_ERP_Backups
```

---

## 3. Database Migration Deployment

Before running the application against a new database, execute the 6 sequential database migrations located in [`database/migrations/`](file:///data/user/0/com.termux/files/home/YE/database/migrations):

```bash
# Connect to your PostgreSQL database with psql:
psql -h <db-host> -U <db-user> -d <db-name> -f database/migrations/001_initial_schema.sql
psql -h <db-host> -U <db-user> -d <db-name> -f database/migrations/002_views_and_functions.sql
psql -h <db-host> -U <db-user> -d <db-name> -f database/migrations/003_auth_and_rls.sql
psql -h <db-host> -U <db-user> -d <db-name> -f database/migrations/004_multi_company_schema.sql
psql -h <db-host> -U <db-user> -d <db-name> -f database/migrations/005_accounting_and_documents.sql
psql -h <db-host> -U <db-user> -d <db-name> -f database/migrations/006_backup_and_restore.sql
```

---

## 4. Deployment Option A: Running on Termux (Android Mobile / Local Yard)

When operating locally inside the scrap yard office via Termux:

```bash
# 1. Navigate to project directory
cd /data/user/0/com.termux/files/home/YE

# 2. Install dependencies via pnpm
pnpm install

# 3. Verify TypeScript and test suite
pnpm tsc --noEmit
node scripts/test-runner.mjs

# 4. Build production static bundle
pnpm build

# 5. Serve locally over LAN for office computers & weighbridge
pnpm preview --host 0.0.0.0 --port 5173
```
*Access from other tablets or PCs connected to the yard Wi-Fi at: `http://<phone-ip>:5173`.*

---

## 5. Deployment Option B: Dedicated Ubuntu / Debian Linux Server

For a permanent cloud or on-premise server:

### Step 1: Clone & Install Dependencies
```bash
git clone https://github.com/yashoth-enterprises/ye-erp.git /var/www/ye-erp
cd /var/www/ye-erp
pnpm install --frozen-lockfile
```

### Step 2: Build Production Bundle
```bash
pnpm build
```
The optimized production bundle will be generated in `/var/www/ye-erp/dist`.

### Step 3: Nginx Reverse Proxy with SSL Configuration
Create `/etc/nginx/sites-available/ye-erp.conf`:

```nginx
server {
    listen 80;
    server_name erp.yashothenterprises.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name erp.yashothenterprises.com;

    ssl_certificate /etc/letsencrypt/live/erp.yashothenterprises.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.yashothenterprises.com/privkey.pem;

    root /var/www/ye-erp/dist;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://www.googleapis.com;";

    # Single Page Application fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Assets Caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Service Worker (Never Cache sw.js to allow immediate updates)
    location = /sw.js {
        expires off;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # PWA Manifest
    location = /manifest.webmanifest {
        add_header Content-Type "application/manifest+json";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ye-erp.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Deployment Option C: Docker Containerization

### Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Run
```bash
docker build -t yashoth-erp:v1.0.0 .
docker run -d -p 8080:80 --name ye-erp-prod --restart always yashoth-erp:v1.0.0
```

---

## 7. Post-Deployment Verification Checklist

- [ ] HTTPS is active with a valid SSL/TLS certificate.
- [ ] Service worker registers successfully in browser DevTools.
- [ ] PWA installation prompt triggers in Chrome / Safari.
- [ ] Active Company switches between `YE-MAIN` and `CS-BRANCH` seamlessly.
- [ ] Weighment entry calculations and A4 Tax Invoice printing function properly.
- [ ] Offline test: Toggle airplane mode, record a weighment, re-enable internet, verify auto-sync.
- [ ] Backup Manager executes an encrypted `.yebak` export and restore preview passes.

---
**Prepared by:** DevOps & Senior ERP Architect, Yashoth Enterprises
