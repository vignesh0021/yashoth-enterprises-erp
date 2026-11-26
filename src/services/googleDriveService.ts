/**
 * YASHOTH ENTERPRISES ERP — SECURE GOOGLE DRIVE INTEGRATION
 *
 * Implements client-side OAuth 2.0 via Google Identity Services (GIS) token client.
 * Security Compliance:
 * - NEVER uses or exposes client secrets or service-role keys in frontend code.
 * - Restricts scope strictly to 'https://www.googleapis.com/auth/drive.file' (only files created by YE ERP).
 * - Implements graceful offline / simulated fallbacks when Google Client ID is unconfigured.
 */

export interface GoogleDriveConfig {
  clientId: string;
  scope: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: string;
}

export interface GoogleDriveStatus {
  isConnected: boolean;
  userEmail?: string;
  hasClientId: boolean;
}

import {
  calculateSHA256,
  compressBackupGzip,
  decompressBackupGzip,
} from '../../backend/business-rules/backupEngine.ts';

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

class GoogleDriveService {
  private accessToken: string | null = null;
  private tokenClient: any = null;
  private userEmail: string | null = null;
  private customClientId: string = '';
  private defaultOfficialEmail: string = 'yashothenterprises44@gmail.com';

  constructor() {
    this.customClientId = safeGetItem('ye_gdrive_client_id') || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
    const savedEmail = safeGetItem('ye_gmail_backup_account');
    if (savedEmail) {
      this.userEmail = savedEmail;
    } else {
      // Default to official Yashoth Enterprises proprietor email
      this.userEmail = this.defaultOfficialEmail;
      safeSetItem('ye_gmail_backup_account', this.defaultOfficialEmail);
    }
  }

  public setClientId(clientId: string): void {
    this.customClientId = clientId.trim();
    safeSetItem('ye_gdrive_client_id', this.customClientId);
  }

  public getClientId(): string {
    return this.customClientId;
  }

  public isConfigured(): boolean {
    return !!this.customClientId;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.accessToken);
  }

  public connectGmailAccount(email: string): { success: boolean; userEmail: string } {
    const clean = email.trim().toLowerCase();
    this.userEmail = clean || this.defaultOfficialEmail;
    safeSetItem('ye_gmail_backup_account', this.userEmail);
    return { success: true, userEmail: this.userEmail };
  }

  public getUserEmail(): string {
    return this.getConnectedEmail();
  }

  public getConnectedEmail(): string {
    return this.userEmail || safeGetItem('ye_gmail_backup_account') || this.defaultOfficialEmail;
  }

  public getStatus(): GoogleDriveStatus & { isNativeAndroid: boolean } {
    const email = this.getConnectedEmail();
    const isNativeAndroid = typeof window !== 'undefined' && Boolean((window as any).AndroidNative);
    return {
      isConnected: Boolean(this.accessToken),
      userEmail: email,
      hasClientId: this.isConfigured(),
      isNativeAndroid,
    };
  }

  /**
   * Initializes GIS OAuth Token Client.
   * Google Identity Services script is dynamically loaded if present.
   */
  public async initClient(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!this.customClientId) {
      return false;
    }

    // Check if google accounts script is loaded
    if (!(window as any).google?.accounts?.oauth2) {
      await this.loadGsiScript();
    }

    if ((window as any).google?.accounts?.oauth2) {
      this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: this.customClientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (tokenResponse: any) => {
          if (tokenResponse?.access_token) {
            this.accessToken = tokenResponse.access_token;
          }
        },
      });
      return true;
    }

    return false;
  }

  private loadGsiScript(): Promise<void> {
    return new Promise((resolve) => {
      if (document.getElementById('google-gsi-script')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => resolve(); // Graceful on network failure / offline
      document.head.appendChild(script);
    });
  }

  /**
   * Triggers the interactive Google sign-in consent modal.
   */
  public async signIn(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Google Drive Client ID is not configured. Please enter your Google Cloud OAuth Client ID in Settings.',
      };
    }

    try {
      const ok = await this.initClient();
      if (!ok || !this.tokenClient) {
        return {
          success: false,
          error: 'Google Identity Services could not be initialized. Please check network connection.',
        };
      }

      return new Promise((resolve) => {
        try {
          this.tokenClient.callback = (tokenResponse: any) => {
            if (tokenResponse?.error) {
              resolve({
                success: false,
                error: tokenResponse.error_description || tokenResponse.error || 'Google sign-in was cancelled or failed.',
              });
              return;
            }
            if (tokenResponse?.access_token) {
              this.accessToken = tokenResponse.access_token;
              resolve({ success: true });
            } else {
              resolve({
                success: false,
                error: 'No access token received from Google OAuth.',
              });
            }
          };
          this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (reqErr: any) {
          resolve({
            success: false,
            error: reqErr?.message || 'Failed to request Google OAuth token.',
          });
        }
      });
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Google Drive authentication error.',
      };
    }
  }

  public signOut(): void {
    if (this.accessToken && (window as any).google?.accounts?.oauth2) {
      (window as any).google.accounts.oauth2.revoke(this.accessToken, () => {});
    }
    this.accessToken = null;
    localStorage.removeItem('ye_gmail_backup_account');
    this.userEmail = null;
  }

  /**
   * Dispatches backup directly to connected Gmail via Android Native Share or mailto link.
   */
  public sendBackupViaEmail(filename: string, content: string, summary?: string): boolean {
    const recipient = this.getConnectedEmail();
    const subject = encodeURIComponent(`Yashoth Enterprises ERP — System Backup Archive [${filename}]`);
    const bodyText = encodeURIComponent(
      `YASHOTH ENTERPRISES ERP\n` +
      `Automated System Backup & Financial Snapshot\n\n` +
      `Date: ${new Date().toLocaleString('en-IN')}\n` +
      `Proprietor: Prop. P. NANDHA KUMAR\n` +
      `GSTIN: 33AXVPN9382L1ZF\n` +
      `Backup File: ${filename}\n\n` +
      (summary ? `Summary:\n${summary}\n\n` : '') +
      `To restore this backup, open Yashoth Enterprises ERP -> Settings -> Backup & Restore -> Import Backup JSON.\n\n` +
      `--- BEGIN BACKUP ENCODED ARCHIVE ---\n` +
      content.slice(0, 3000) +
      (content.length > 3000 ? '\n\n[Truncated in email body; complete backup downloaded to phone storage]' : '') +
      `\n--- END BACKUP ARCHIVE ---`
    );

    // Native Android Share if available
    if ((window as any).AndroidNative && typeof (window as any).AndroidNative.shareText === 'function') {
      (window as any).AndroidNative.shareText(`YE Backup - ${filename}`, `Backup for ${recipient}\n\n${summary || ''}`);
    }

    // Open Gmail compose
    const mailtoUrl = `mailto:${recipient}?subject=${subject}&body=${bodyText}`;
    window.open(mailtoUrl, '_blank');
    return true;
  }

  /**
   * Downloads backup file locally to device Downloads.
   */
  public downloadBackupLocally(filename: string, content: string, mimeType: string = 'application/json'): void {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Uploads backup file to Google Drive using standard REST v3 multipart upload.
   */
  public async uploadBackupFile(
    filename: string,
    content: string,
    mimeType: string = 'application/json'
  ): Promise<{ success: boolean; fileId?: string; error?: string; isNative?: boolean }> {
    // 1. If running on Android with Native Bridge without Google OAuth token, forward to Android Share Sheet
    if (
      typeof window !== 'undefined' &&
      (window as any).AndroidNative &&
      typeof (window as any).AndroidNative.shareBackupFile === 'function' &&
      !this.accessToken
    ) {
      try {
        (window as any).AndroidNative.shareBackupFile(filename, content, mimeType);
      } catch {
        // fallback
      }
      return {
        success: false,
        error: 'Google Drive is not authenticated. Backup was forwarded to Android Share Sheet for external export instead.',
        isNative: true,
      };
    }

    if (!this.accessToken) {
      // In mobile / standalone mode without Google OAuth token: save locally to device storage
      this.downloadBackupLocally(filename, content, mimeType);
      return {
        success: false,
        error: 'Google Drive is not authenticated. File was downloaded to device local storage instead.',
      };
    }

    try {
      const metadata = {
        name: filename,
        mimeType: mimeType,
        description: 'Yashoth Enterprises ERP Automated Backup',
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n` +
        content +
        closeDelim;

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errMsg = errorData.error?.message;
        if (!errMsg) {
          if (response.status === 401) errMsg = 'HTTP 401 Unauthorized: Invalid or expired Google OAuth access token.';
          else if (response.status === 403) errMsg = 'HTTP 403 Forbidden: Insufficient Google Drive permissions or scope.';
          else if (response.status === 404) errMsg = 'HTTP 404 Not Found: Google Drive upload endpoint unavailable.';
          else if (response.status >= 500) errMsg = `HTTP ${response.status} Server Error: Google Drive backend service unavailable.`;
          else errMsg = `HTTP ${response.status}: Failed to upload to Google Drive.`;
        }
        throw new Error(errMsg);
      }

      const fileData = await response.json();
      if (!fileData?.id || typeof fileData.id !== 'string' || fileData.id.trim().length === 0) {
        throw new Error('Google Drive upload response did not return a valid non-empty file ID.');
      }
      return { success: true, fileId: fileData.id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to upload backup to Google Drive.' };
    }
  }

  /**
   * Verifies that a remote Google Drive file exists, is downloadable, and matches expected SHA-256 checksum.
   * NEVER claims backup success without remote verification.
   */
  public async verifyRemoteFile(
    fileId: string,
    expectedSha256?: string
  ): Promise<{ verified: boolean; sizeBytes?: number; actualSha256?: string; error?: string }> {
    if (!this.accessToken) {
      return { verified: false, error: 'Not authenticated with Google Drive.' };
    }
    if (!fileId || !fileId.trim()) {
      return { verified: false, error: 'Invalid Google Drive file ID.' };
    }

    try {
      const dl = await this.downloadFile(fileId);
      if (!dl.success || dl.content === undefined) {
        return { verified: false, error: dl.error || 'Failed to read back remote file for verification.' };
      }

      const actualSha256 = await calculateSHA256(dl.content);
      if (expectedSha256 && actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
        return {
          verified: false,
          sizeBytes: dl.content.length,
          actualSha256,
          error: `Remote checksum mismatch! Expected ${expectedSha256.slice(0, 16)}..., got ${actualSha256.slice(0, 16)}...`,
        };
      }

      return {
        verified: true,
        sizeBytes: dl.content.length,
        actualSha256,
      };
    } catch (err: any) {
      return { verified: false, error: err?.message || 'Remote file verification failed.' };
    }
  }

  /**
   * Production Phase 8 verified backup upload:
   * 1. Optionally GZIP-compresses payload (saves ~70–85% Google Drive quota).
   * 2. Uploads with automatic retry (exponential backoff).
   * 3. Reads back & verifies remote file ID and SHA-256 integrity.
   * Only returns success=true when ALL steps succeed!
   */
  public async uploadBackupFileVerified(params: {
    filename: string;
    content: string;
    mimeType?: string;
    compressGzip?: boolean;
    maxRetries?: number;
  }): Promise<{
    success: boolean;
    fileId?: string;
    remoteVerified: boolean;
    compressionFormat: 'NONE' | 'GZIP';
    originalSizeBytes: number;
    uploadedSizeBytes: number;
    sha256Checksum: string;
    retryCount: number;
    error?: string;
  }> {
    const originalSizeBytes = new TextEncoder().encode(params.content).byteLength;
    const maxRetries = Math.max(1, params.maxRetries ?? 3);

    if (!this.accessToken) {
      return {
        success: false,
        remoteVerified: false,
        compressionFormat: params.compressGzip ? 'GZIP' : 'NONE',
        originalSizeBytes,
        uploadedSizeBytes: 0,
        sha256Checksum: '',
        retryCount: 0,
        error: 'Google Drive is not authenticated. Connect your Google account before uploading cloud backups.',
      };
    }

    let uploadContent = params.content;
    let uploadFilename = params.filename;
    let uploadMime = params.mimeType || 'application/json';
    let compressionFormat: 'NONE' | 'GZIP' = 'NONE';

    if (params.compressGzip) {
      const gz = await compressBackupGzip(params.content);
      uploadContent = gz.base64;
      uploadFilename = params.filename.endsWith('.gz') ? params.filename : `${params.filename}.gz`;
      uploadMime = 'application/gzip';
      compressionFormat = 'GZIP';
    }

    const expectedChecksum = await calculateSHA256(params.content);
    const uploadedSizeBytes = new TextEncoder().encode(uploadContent).byteLength;
    let lastError = 'Unknown upload failure';
    let attempts = 0;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      attempts = attempt;
      const upRes = await this.uploadBackupFile(uploadFilename, uploadContent, uploadMime);
      if (upRes.success && upRes.fileId) {
        // Mandatory post-upload remote verification
        const verifyRes = await this.verifyRemoteFile(upRes.fileId, expectedChecksum);
        if (verifyRes.verified) {
          return {
            success: true,
            fileId: upRes.fileId,
            remoteVerified: true,
            compressionFormat,
            originalSizeBytes,
            uploadedSizeBytes,
            sha256Checksum: expectedChecksum,
            retryCount: attempt - 1,
          };
        }
        lastError = verifyRes.error || 'Remote upload checksum verification failed.';
      } else {
        lastError = upRes.error || 'Google Drive upload failed.';
      }

      // Short retry backoff (bounded for tests & responsive UX)
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.min(50 * attempt, 200)));
      }
    }

    return {
      success: false,
      remoteVerified: false,
      compressionFormat,
      originalSizeBytes,
      uploadedSizeBytes,
      sha256Checksum: expectedChecksum,
      retryCount: Math.max(0, attempts - 1),
      error: `Backup upload failed after ${attempts} attempt(s): ${lastError}`,
    };
  }

  /**
   * Lists backup files created by this ERP in Google Drive.
   */
  public async listBackups(): Promise<GoogleDriveFile[]> {
    if (!this.accessToken) return [];

    try {
      const query = encodeURIComponent("name contains 'YE_' and trashed = false");
      const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,createdTime)&orderBy=createdTime desc`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data.files || [];
    } catch {
      return [];
    }
  }

  /**
   * Downloads a backup file from Google Drive by ID (automatically decompressing GZIP archives).
   */
  public async downloadFile(fileId: string): Promise<{ success: boolean; content?: string; error?: string }> {
    if (!this.accessToken) {
      return { success: false, error: 'Not authenticated with Google Drive.' };
    }

    try {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: HTTP ${response.status}`);
      }

      const rawText = await response.text();
      // If content is Base64 GZIP (starts with H4sI...), transparently decompress to JSON text
      if (rawText.trim().startsWith('H4sI')) {
        try {
          const decompressed = await decompressBackupGzip(rawText.trim());
          return { success: true, content: decompressed };
        } catch {
          return { success: true, content: rawText };
        }
      }

      return { success: true, content: rawText };
    } catch (err: any) {
      return { success: false, error: err.message || 'Download failed.' };
    }
  }
}

export const googleDriveService = new GoogleDriveService();
