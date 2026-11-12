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

import { teamSyncService } from './teamSyncService.ts';

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
    return !!this.accessToken || !!this.userEmail;
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
    const isNativeAndroid = typeof window !== 'undefined' && !!(window as any).AndroidNative;
    return {
      isConnected: !!this.accessToken || isNativeAndroid,
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
   * Triggers the interactive Google sign-in consent modal, or connects Gmail account for email backup.
   */
  public async signIn(): Promise<{ success: boolean; error?: string }> {
    const email = this.getConnectedEmail();

    if (!this.isConfigured()) {
      // Connect to Gmail directly
      this.connectGmailAccount(email);
      return {
        success: true,
      };
    }

    try {
      await this.initClient();

      if (!this.tokenClient) {
        // Fallback to Gmail email backup mode
        this.connectGmailAccount(email);
        return { success: true };
      }

      return new Promise((resolve) => {
        try {
          this.tokenClient.callback = (tokenResponse: any) => {
            if (tokenResponse.error) {
              // Fallback to Gmail email backup
              this.connectGmailAccount(email);
              resolve({ success: true });
              return;
            }
            this.accessToken = tokenResponse.access_token;
            resolve({ success: true });
          };
          this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch {
          // Fallback to Gmail email backup
          this.connectGmailAccount(email);
          resolve({ success: true });
        }
      });
    } catch {
      this.connectGmailAccount(email);
      return { success: true };
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
    if (typeof document === 'undefined') return;
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
        throw new Error(errorData.error?.message || `HTTP ${response.status}: Failed to upload to Google Drive.`);
      }

      const fileData = await response.json();
      return { success: true, fileId: fileData.id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to upload backup to Google Drive.' };
    }
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
   * Downloads a backup file from Google Drive by ID.
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

      const content = await response.text();
      return { success: true, content };
    } catch (err: any) {
      return { success: false, error: err.message || 'Download failed.' };
    }
  }
}

export const googleDriveService = new GoogleDriveService();
