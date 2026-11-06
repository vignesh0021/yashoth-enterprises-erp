# YASHOTH ENTERPRISES ERP — GOOGLE DRIVE OAUTH & CLOUD SETUP GUIDE

**Target Audience:** System Administrators & Cloud Security Engineers  
**System:** Yashoth Enterprises Scrap ERP (YE ERP)  
**Security Standard:** Zero Client Secrets / PKCE Authorization Code Flow  

---

## 1. Security Invariants (MANDATORY)

> [!IMPORTANT]
> - **NEVER** expose Google OAuth Client Secrets in frontend code or Git repositories.
> - Client-side Google Drive integrations MUST use the **OAuth 2.0 Authorization Code flow with PKCE** (Proof Key for Code Exchange) or short-lived Google Identity Services tokens.
> - Access tokens must be stored in secure browser storage and only transmitted directly to official Google API endpoints over TLS 1.3 (`https://www.googleapis.com/*`).

---

## 2. Google Cloud Platform (GCP) Project Setup

Follow these steps to configure Google Drive backup destinations:

### Step 1: Create a Google Cloud Project
1. Log in to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top and select **New Project**.
3. Set the Project Name: `Yashoth-Enterprises-ERP-Backups`.
4. Click **Create**.

### Step 2: Enable the Google Drive API
1. In the left navigation, go to **APIs & Services → Library**.
2. Search for **Google Drive API**.
3. Select it and click **Enable**.

### Step 3: Configure the OAuth Consent Screen
1. Navigate to **APIs & Services → OAuth consent screen**.
2. Select **External** (or **Internal** if using Google Workspace for your business domain).
3. Fill in the App Information:
   - **App name:** `Yashoth Enterprises ERP Backup Manager`
   - **User support email:** `accounts@yashothenterprises.com`
   - **Developer contact information:** `admin@yashothenterprises.com`
4. In the **Scopes** section, click **Add or Remove Scopes**.
5. Select the minimal necessary scope:
   - `https://www.googleapis.com/auth/drive.file`  
     *(Per-file access: allows the ERP to upload and manage ONLY files it creates; does NOT grant access to the user's other private Drive files)*.
6. Under **Test Users**, add authorized staff Google accounts (e.g., `owner@yashothenterprises.com`).
7. Save and submit.

### Step 4: Create OAuth 2.0 Client ID Credentials
1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth client ID**.
3. Select Application Type: **Web application**.
4. Name: `YE ERP Web Client`.
5. Under **Authorized JavaScript Origins**, add your application origins:
   - `https://erp.yashothenterprises.com` (Production URL)
   - `http://localhost:5173` (Local Development)
   - `http://192.168.1.100:5173` (Scrap Yard LAN Server)
6. Under **Authorized Redirect URIs**, add:
   - `https://erp.yashothenterprises.com/oauth/callback`
   - `http://localhost:5173/oauth/callback`
7. Click **Create**.
8. Copy the **Client ID** (e.g., `1234567890-abcdef.apps.googleusercontent.com`).
9. **DO NOT copy or save the Client Secret** into the frontend environment.

---

## 3. Configuring the ERP Application

In your production `.env` file (or deployment environment variables), configure the public client ID:

```env
# Public Google OAuth Client ID (Safe for frontend consumption)
VITE_GOOGLE_CLIENT_ID="1234567890-abcdef.apps.googleusercontent.com"

# Dedicated Backup Folder Name inside Google Drive
VITE_GOOGLE_DRIVE_BACKUP_FOLDER="Yashoth_ERP_Backups"
```

---

## 4. Operational Backup Workflow in the ERP

1. Log in to the ERP as an **ADMIN**.
2. Navigate to **Settings → Backup & Restore Manager**.
3. Under **Google Drive Cloud Sync**, click **Connect Google Drive**.
4. A Google Sign-In pop-up will appear requesting permission to save files into your Google Drive.
5. Review and accept permissions.
6. Once connected, your Google account email is displayed with a green **Connected** badge.
7. Any manual or scheduled backup with destination `GOOGLE_DRIVE` will automatically upload the `.yebak` archive directly to your `Yashoth_ERP_Backups` Drive folder.
8. To disconnect, click **Disconnect Google Drive**; stored tokens will be cleared immediately from browser storage.

---
**Verified by:** Cloud Infrastructure Security Engineer, Yashoth Enterprises
