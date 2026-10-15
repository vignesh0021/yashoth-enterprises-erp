# Yasoth Enterprises Scrap ERP — Deployment & Operations Guide

## 1. Hosting Architecture Options

### Option A: Self-Hosted PostgreSQL + Node / Static Nginx (Recommended for Single Yard / On-Premise)
- **Database:** Dedicated PostgreSQL 15+ instance.
- **Frontend:** Static web server (Nginx, Caddy, or Cloudflare Pages) serving `dist/`.
- **Security:** Strict firewall rules restricting database port 5432 to internal yard network or VPN.

### Option B: Cloud Architecture (Supabase + Vercel / Netlify)
- **Database:** Managed Supabase PostgreSQL instance with Row-Level Security (RLS).
- **Authentication:** Supabase Auth with JWT session management.
- **Storage:** Private S3-compatible bucket for weighbridge slip photos and vehicle document attachments.

---

## 2. Environment Configuration

Copy `.env.example` to `.env.local` or set environment variables in your deployment platform:

```bash
# Application Environment
VITE_APP_ENV=production
VITE_APP_NAME="Yasoth Enterprises Scrap ERP"
VITE_APP_VERSION="1.0.0"

# Database & Supabase Endpoint (if utilizing cloud backend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key

# Business Defaults
VITE_DEFAULT_CURRENCY=INR
VITE_DEFAULT_BASE_UNIT=KG
VITE_DEFAULT_STATE_CODE=33
VITE_DEFAULT_GST_RATE=18
```

> [!CAUTION]
> Never expose database passwords or Supabase `service_role` secret keys in frontend files or `.env` client variables.

---

## 3. Database Migration Execution

Execute the versioned migrations in order:

```bash
# 1. Connect to PostgreSQL and apply initial schema
psql -h localhost -U postgres -d yasoth_erp -f database/migrations/001_initial_schema.sql

# 2. Apply analytical views and calculation functions
psql -h localhost -U postgres -d yasoth_erp -f database/migrations/002_views_and_functions.sql

# 3. (Optional - Development / Staging ONLY) Apply test seed data
# DO NOT EXECUTE ON PRODUCTION:
# psql -h localhost -U postgres -d yasoth_erp -f database/seed/dev_seed.sql
```

---

## 4. Production Build & Serving

```bash
# Build optimized production bundle
npm run build

# Preview locally or verify build
npm run preview
```

### Sample Nginx Configuration
```nginx
server {
    listen 80;
    server_name erp.yasothenterprises.in;

    root /var/www/yasoth-erp/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Enable gzip compression for speed
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

---

## 5. Automated Backup & Disaster Recovery

### Automated Daily PostgreSQL Dump Cron Job
```bash
# Add to /etc/cron.daily/backup-yasoth-erp
#!/bin/bash
BACKUP_DIR="/var/backups/yasoth_erp"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p $BACKUP_DIR
pg_dump -U postgres -d yasoth_erp -F c -b -v -f "$BACKUP_DIR/yasoth_erp_$TIMESTAMP.dump"
# Keep last 30 days only
find $BACKUP_DIR -type f -mtime +30 -name "*.dump" -exec rm {} \;
```

### Database Restoration Procedure
```bash
# Restore from a backup dump
pg_restore -U postgres -d yasoth_erp -v "/var/backups/yasoth_erp/yasoth_erp_20261015.dump"
```
